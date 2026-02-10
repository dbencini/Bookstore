const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { sequelize, Book, Job } = require('./models');
const { buildAuthorCache } = require('./build_author_cache');

/**
 * Stable, Resumable Author Repair
 * - Uses database for ISBN mappings (not memory)
 * - Saves checkpoints for resumability
 * - Minimal memory footprint (<1GB)
 * - Real-time progress updates
 */

const activeJobs = new Set();

async function getCheckpoint(jobId) {
    const [results] = await sequelize.query(
        'SELECT * FROM repair_checkpoints WHERE job_id = ?',
        { replacements: [jobId] }
    );
    return results[0] || null;
}

async function saveCheckpoint(jobId, phase, data) {
    const { lastPosition, lastBookId, recordsProcessed, mappingsCreated, booksUpdated } = data;

    await sequelize.query(`
        INSERT INTO repair_checkpoints 
        (job_id, phase, last_position, last_book_id, records_processed, mappings_created, books_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        phase = VALUES(phase),
        last_position = VALUES(last_position),
        last_book_id = VALUES(last_book_id),
        records_processed = VALUES(records_processed),
        mappings_created = VALUES(mappings_created),
        books_updated = VALUES(books_updated),
        updated_at = CURRENT_TIMESTAMP
    `, {
        replacements: [jobId, phase, lastPosition || 0, lastBookId || 0,
            recordsProcessed || 0, mappingsCreated || 0, booksUpdated || 0]
    });
}

async function repairAuthorsStable() {
    // 1. Check if a job is already locally active
    if (activeJobs.size > 0) {
        console.log('[Admin] Repair already in progress locally.');
        return;
    }

    // 2. Check database for "ghost" jobs (marked running but process died)
    const existingJob = await Job.findOne({
        where: { type: 'author_repair_stable', status: 'running' },
        order: [['createdAt', 'DESC']]
    });

    if (existingJob) {
        console.log(`[Admin] Marking ghost job ${existingJob.id} as stopped.`);
        existingJob.status = 'stopped';
        existingJob.summary = 'Job stopped due to server restart or new job start.';
        await existingJob.save();
    }

    // 3. Create NEW job
    const job = await Job.create({
        type: 'author_repair_stable',
        summary: 'Initializing stable author repair...',
        startTime: new Date(),
        status: 'running',
        progress: 0
    });

    activeJobs.add(job.id);
    console.log(`[Job ${job.id}] Started stable author repair`);

    try {
        // Check for existing checkpoint
        let checkpoint = await getCheckpoint(job.id);

        // If no checkpoint for THIS job, check for ANY recent checkpoint to resume from
        if (!checkpoint) {
            const lastCheckpoint = await sequelize.query(
                'SELECT * FROM repair_checkpoints WHERE phase != "mapping" ORDER BY updated_at DESC LIMIT 1'
            );
            if (lastCheckpoint[0] && lastCheckpoint[0][0]) {
                checkpoint = lastCheckpoint[0][0];
                console.log(`[Job ${job.id}] Resuming from last known checkpoint: ${checkpoint.job_id}`);
            }
        }

        // Check if mappings already exist (from previous run)
        const [countResult] = await sequelize.query('SELECT COUNT(*) as count FROM isbn_author_mappings');
        const existingMappings = countResult[0].count;

        // PHASE 1: Build ISBN mapping table (skip if already exists)
        if (existingMappings > 0) {
            console.log(`[Job ${job.id}] ✅ Skipping Phase 1: ${existingMappings.toLocaleString()} mappings already exist`);
            job.summary = `Phase 1/3: Using existing ${existingMappings.toLocaleString()} ISBN mappings`;
            job.progress = 25;
            await job.save();
        } else if (!checkpoint || checkpoint.phase === 'mapping') {
            await buildMappingTable(job, checkpoint);
        }

        // PHASE 2: Build author cache
        // Always load this because it's in-memory and lost on restart
        const authorCache = await buildAuthorCachePhase(job);

        // PHASE 3: Update books
        await updateBooksPhase(job, authorCache, checkpoint);

        // Complete
        job.status = 'completed';
        job.progress = 100;
        job.summary = 'Author repair completed successfully!';
        job.endTime = new Date();
        await job.save();

        console.log(`[Job ${job.id}] ✅ Repair complete!`);
        activeJobs.delete(job.id);

        return { success: true, jobId: job.id };

    } catch (err) {
        console.error(`[Job ${job.id}] ❌ Error:`, err);
        job.status = 'failed';
        job.summary = `Error: ${err.message}`;
        job.endTime = new Date();
        await job.save();
        activeJobs.delete(job.id);
        throw err;
    }
}

async function buildMappingTable(job, checkpoint) {
    console.log(`[Job ${job.id}] Phase 1: Building ISBN mapping table`);

    job.summary = 'Phase 1/3: Reading OpenLibraryAuthors.txt (7.6M authors) - This will take approximately 10-15 minutes';
    job.progress = 5;
    await job.save();

    const authorsPath = path.join(__dirname, 'uploads', 'OpenLibraryAuthors.txt');
    if (!fs.existsSync(authorsPath)) {
        throw new Error('OpenLibraryAuthors.txt not found!');
    }

    let recordsProcessed = checkpoint?.records_processed || 0;
    let mappingsCreated = checkpoint?.mappings_created || 0;
    let lineNumber = 0;
    const startTime = Date.now();

    // Clear old mappings if starting fresh (TRUNCATE is instant)
    if (!checkpoint) {
        console.log(`[Job ${job.id}] Clearing old mapping table...`);
        await sequelize.query('TRUNCATE TABLE isbn_author_mappings');
        console.log(`[Job ${job.id}] ✅ Table cleared, starting file read...`);
    }

    const fileStream = fs.createReadStream(authorsPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let batchMappings = [];
    const BATCH_SIZE = 10000;

    console.log(`[Job ${job.id}] Reading OpenLibraryAuthors.txt...`);

    for await (const line of rl) {
        lineNumber++;

        // Skip to checkpoint position
        if (checkpoint && lineNumber <= checkpoint.last_position) {
            continue;
        }

        // Check if stopped
        if (lineNumber % 50000 === 0) {
            await job.reload();
            if (job.status !== 'running' || !activeJobs.has(job.id)) {
                fileStream.destroy();
                rl.close();
                return;
            }
        }

        recordsProcessed++;

        try {
            const parts = line.split('\t');
            if (parts.length < 5) continue;

            const record = JSON.parse(parts[4]);

            // Extract ISBNs from source_records (format: "bwb:9781234567890")
            if (record.source_records && record.source_records.length > 0 && record.key) {
                const authorKey = record.key; // e.g., /authors/OL123A

                record.source_records.forEach(sr => {
                    // Extract ISBN from patterns like "bwb:9781234567890"
                    const parts = sr.split(':');
                    if (parts.length >= 2) {
                        const isbn = parts[1];
                        // Validate ISBN format (10 or 13 digits)
                        if (/^\d{10,13}$/.test(isbn)) {
                            batchMappings.push({ isbn, authorKeys: authorKey });
                        }
                    }
                });
            }
        } catch (err) {
            continue;
        }

        // Batch insert
        if (batchMappings.length >= BATCH_SIZE) {
            await insertMappingBatch(batchMappings);
            mappingsCreated += batchMappings.length;
            batchMappings = [];

            // Save checkpoint every 1M records
            if (recordsProcessed % 1000000 === 0) {
                await saveCheckpoint(job.id, 'mapping', {
                    lastPosition: lineNumber,
                    recordsProcessed,
                    mappingsCreated
                });

                const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
                const progress = 5 + Math.min(20, Math.floor((recordsProcessed / 7600000) * 20));

                // Calculate ETA for Phase 1 (7.6M authors, target: ~12 min total)
                const recordsPerMin = recordsProcessed / parseFloat(elapsed);
                const remainingRecords = 7600000 - recordsProcessed;
                const etaMin = recordsPerMin > 0 ? Math.ceil(remainingRecords / recordsPerMin) : 0;
                const etaText = etaMin > 0 ? ` • ETA: ~${etaMin} min` : '';

                job.summary = `Phase 1/3: Processed ${recordsProcessed.toLocaleString()} / 7.6M authors, created ${mappingsCreated.toLocaleString()} mappings${etaText}`;
                job.progress = progress;
                await job.save();

                console.log(`[Job ${job.id}] Phase 1: ${recordsProcessed.toLocaleString()} processed, ${mappingsCreated.toLocaleString()} mappings (${elapsed} min)`);
            }
        }
    }

    // Insert remaining
    if (batchMappings.length > 0) {
        await insertMappingBatch(batchMappings);
        mappingsCreated += batchMappings.length;
    }

    await saveCheckpoint(job.id, 'mapping_complete', {
        lastPosition: lineNumber,
        recordsProcessed,
        mappingsCreated
    });

    job.summary = `Phase 1/3 Complete: ${mappingsCreated.toLocaleString()} ISBN mappings created`;
    job.progress = 25;
    await job.save();

    console.log(`[Job ${job.id}] ✅ Phase 1 complete: ${mappingsCreated} mappings`);
}

async function insertMappingBatch(mappings) {
    if (mappings.length === 0) return;

    const values = mappings.map(m =>
        `('${m.isbn.replace(/'/g, "''")}', '${m.authorKeys.replace(/'/g, "''")}')`
    ).join(',');

    await sequelize.query(`
        INSERT IGNORE INTO isbn_author_mappings (isbn, author_keys)
        VALUES ${values}
    `, { logging: false });
}

async function buildAuthorCachePhase(job) {
    console.log(`[Job ${job.id}] Phase 2: Building author cache`);

    job.summary = 'Phase 2/3: Loading author names into cache...';
    job.progress = 30;
    await job.save();

    const authorCache = await buildAuthorCache();

    job.summary = `Phase 2/3 Complete: ${authorCache.size.toLocaleString()} authors cached`;
    job.progress = 45;
    await job.save();

    console.log(`[Job ${job.id}] ✅ Phase 2 complete: ${authorCache.size} authors`);
    return authorCache;
}

async function updateBooksPhase(job, authorCache, checkpoint) {
    console.log(`[Job ${job.id}] Phase 3: Updating books`);

    job.summary = 'Phase 3/3: Updating book authors from mappings...';
    job.progress = 50;
    await job.save();

    let lastBookId = checkpoint?.last_book_id || 0;
    let booksUpdated = checkpoint?.books_updated || 0;
    let booksScanned = checkpoint?.records_processed || 0;
    const BATCH_SIZE = 1000;
    const startTime = Date.now();

    // Get total count of books that need repair (denominator should be stable)
    const [countResult] = await sequelize.query(`
        SELECT COUNT(*) as count 
        FROM books 
        WHERE (author IS NULL OR author = '' OR author = 'Unknown')
        AND isbn IS NOT NULL AND isbn != ''
    `);
    const remainingToFix = countResult[0].count;
    const totalBooks = booksScanned + remainingToFix; // Stable total across restarts

    console.log(`[Job ${job.id}] Phase 3: ${totalBooks} books to process`);

    while (true) {
        // Check if stopped
        await job.reload();
        if (job.status !== 'running' || !activeJobs.has(job.id)) {
            await saveCheckpoint(job.id, 'updating', {
                lastBookId,
                booksUpdated,
                recordsProcessed: booksScanned
            });
            return;
        }

        // Fetch batch using cursor-based pagination
        const books = await Book.findAll({
            where: {
                id: { [sequelize.Sequelize.Op.gt]: lastBookId },
                [sequelize.Sequelize.Op.or]: [
                    { author: null },
                    { author: '' },
                    { author: 'Unknown' }
                ],
                isbn: { [sequelize.Sequelize.Op.ne]: null }
            },
            limit: BATCH_SIZE,
            order: [['id', 'ASC']],
            attributes: ['id', 'isbn', 'author']
        });

        if (books.length === 0) {
            console.log(`[Job ${job.id}] Phase 3: No more books`);
            break;
        }

        // Update cursor and scan count
        lastBookId = books[books.length - 1].id;
        booksScanned += books.length;

        // Process batch
        for (const book of books) {
            // Look up mapping
            const [mappings] = await sequelize.query(
                'SELECT author_keys FROM isbn_author_mappings WHERE isbn = ?',
                { replacements: [book.isbn] }
            );

            if (mappings.length > 0) {
                const authorKeys = mappings[0].author_keys.split(',');
                const authorNames = authorKeys
                    .map(key => {
                        const authorId = key.replace('/authors/', '');
                        return authorCache.get(authorId);
                    })
                    .filter(name => name);

                if (authorNames.length > 0) {
                    book.author = authorNames.join(', ').substring(0, 2000);
                    await book.save();
                    booksUpdated++;
                }
            }
        }

        // Save checkpoint and update progress every batch
        await saveCheckpoint(job.id, 'updating', {
            lastBookId,
            booksUpdated,
            recordsProcessed: booksScanned
        });

        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        const progress = totalBooks > 0
            ? 50 + Math.min(45, Math.floor((booksScanned / totalBooks) * 45))
            : 95;

        // Calculate ETA for Phase 3
        const booksPerMin = booksScanned / parseFloat(elapsed);
        const remainingBooks = Math.max(0, totalBooks - booksScanned);
        const etaMin = (booksPerMin > 0 && totalBooks > 0) ? Math.ceil(remainingBooks / booksPerMin) : 0;
        const etaText = etaMin > 0 ? ` • ETA: ~${etaMin} min` : '';

        // ULTRA-SIMPLE format for the UI to parse without any regex confusion
        job.summary = `Scanned: ${booksScanned}, Fixed: ${booksUpdated}, Total: ${totalBooks}${etaText}`;
        job.progress = progress;
        await job.save();

        // Reduce console spam: only log every 10 batches (10,000 books)
        if (booksScanned % 10000 === 0 || books.length < BATCH_SIZE) {
            console.log(`[Job ${job.id}] Phase 3: ${booksScanned.toLocaleString()} scanned, ${booksUpdated.toLocaleString()} updated (${elapsed} min)`);
        }
    }

    console.log(`[Job ${job.id}] ✅ Phase 3 complete: ${booksUpdated} books updated`);
}

// Export functions
function stopJob(jobId) {
    activeJobs.delete(jobId);
}

function pauseJob(jobId) {
    activeJobs.delete(jobId);
}

function resumeJob(jobId) {
    activeJobs.add(jobId);
}

module.exports = {
    repairAuthorsStable,
    stopJob,
    pauseJob,
    resumeJob
};
