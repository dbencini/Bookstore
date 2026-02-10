const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { Op } = require('sequelize');
const { sequelize, Book, Job } = require('./models');

/**
 * Stable, DB-Backed Author Repair
 * - Stores all Open Library data in MySQL (no OOM)
 * - Single-pass file processing
 * - Batch updates using SQL JOINS
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
    if (activeJobs.size > 0) {
        console.log('[Admin] Repair already in progress locally.');
        return;
    }

    const existingJob = await Job.findOne({
        where: { type: 'author_repair_stable', status: 'running' },
        order: [['createdAt', 'DESC']]
    });

    if (existingJob) {
        existingJob.status = 'stopped';
        existingJob.summary = 'Job stopped due to server restart or new job start.';
        await existingJob.save();
    }

    const job = await Job.create({
        type: 'author_repair_stable',
        summary: 'Initializing DB-backed author repair...',
        startTime: new Date(),
        status: 'running',
        progress: 0
    });

    activeJobs.add(job.id);
    console.log(`[Job ${job.id}] Started DB-backed author repair`);

    try {
        let checkpoint = await getCheckpoint(job.id);

        if (!checkpoint) {
            const lastCheckpoint = await sequelize.query(
                'SELECT * FROM repair_checkpoints WHERE phase != "mapping" ORDER BY updated_at DESC LIMIT 1'
            );
            if (lastCheckpoint[0] && lastCheckpoint[0][0]) {
                checkpoint = lastCheckpoint[0][0];
                console.log(`[Job ${job.id}] Resuming from last known checkpoint: ${checkpoint.job_id}`);
            }
        }

        // PHASE 1: Populate mappings and authors from file
        // We now allow "Syncing" even if records exist, to grow the master table.
        // But we still honor resume-from-checkpoint for the current job.
        if (!checkpoint && mappingCount[0].count > 0 && authorCount[0].count > 0) {
            console.log(`[Job ${job.id}] ⚠️ DB already populated (${mappingCount[0].count} mappings). Starting Incremental Sync...`);
            job.summary = 'Phase 1/2: Syncing new data from Open Library dump...';
            await job.save();
        }

        // SMART RESUME: If Phase 1 was completed TODAY, skip it entirely.
        const isPhase1Done = checkpoint && (checkpoint.phase === 'mapping_complete' || checkpoint.phase === 'updating');
        const isToday = checkpoint && new Date(checkpoint.updated_at).toDateString() === new Date().toDateString();

        if (isPhase1Done && isToday) {
            console.log(`[Job ${job.id}] ⏩ Phase 1 completed today (${new Date(checkpoint.updated_at).toLocaleTimeString()}). Skipping ingest.`);
            job.progress = 50;
            // Ensure we don't overwrite the summary if we are in the middle of phase 2
            if (checkpoint.phase === 'mapping_complete') {
                job.summary = 'Phase 1 skipped (completed today). Starting Phase 2...';
            }
            await job.save();
        } else {
            await buildDbTables(job, checkpoint);
        }

        // PHASE 2: Update books using SQL Joins
        await updateBooksPhase(job, checkpoint);

        job.status = 'completed';
        job.progress = 100;
        job.summary = 'Author repair completed successfully using DB join!';
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

async function buildDbTables(job, checkpoint) {
    console.log(`[Job ${job.id}] Phase 1: Populating DB mapping & author tables`);
    job.summary = 'Phase 1/2: Migrating Open Library names and ISBNs to DB (One Pass)...';
    job.progress = 5;
    await job.save();

    const authorsPath = path.join(__dirname, 'uploads', 'OpenLibraryAuthors.txt');
    if (!fs.existsSync(authorsPath)) throw new Error('OpenLibraryAuthors.txt not found!');

    let recordsProcessed = checkpoint?.records_processed || 0;
    let mappingsCreated = checkpoint?.mappings_created || 0;
    let lineNumber = 0;
    const startTime = Date.now();
    let lastUpdate = Date.now();

    const fileStream = fs.createReadStream(authorsPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let batchMappings = [];
    let batchAuthors = [];
    const BATCH_SIZE = 5000;

    for await (const line of rl) {
        lineNumber++;
        if (checkpoint && lineNumber <= checkpoint.last_position) continue;

        if (lineNumber % 50000 === 0) {
            await job.reload();
            if (job.status !== 'running' || !activeJobs.has(job.id)) {
                fileStream.destroy(); rl.close(); return;
            }
        }

        recordsProcessed++;
        try {
            const parts = line.split('\t');
            if (parts.length < 5) continue;

            const authorKey = parts[1]; // /authors/OL123A
            const record = JSON.parse(parts[4]);

            // 1. Author Name
            if (record.name && authorKey) {
                const authorId = authorKey.replace('/authors/', '');
                batchAuthors.push({ author_id: authorId, name: record.name });
            }

            // 2. ISBN Mappings
            if (record.source_records && record.source_records.length > 0 && authorKey) {
                record.source_records.forEach(sr => {
                    const srParts = sr.split(':');
                    if (srParts.length >= 2 && /^\d{10,13}$/.test(srParts[1])) {
                        batchMappings.push({ isbn: srParts[1], author_keys: authorKey });
                    }
                });
            }
        } catch (err) { continue; }

        if (batchAuthors.length >= BATCH_SIZE || batchMappings.length >= BATCH_SIZE) {
            await insertAuthorBatch(batchAuthors);
            await insertMappingBatch(batchMappings);
            mappingsCreated += batchMappings.length;
            batchAuthors = []; batchMappings = [];

            // Update UI every 4 seconds (or at least every 500k records as backup)
            if (Date.now() - lastUpdate > 4000 || recordsProcessed % 500000 === 0) {
                lastUpdate = Date.now();
                await saveCheckpoint(job.id, 'mapping', { lastPosition: lineNumber, recordsProcessed, mappingsCreated });

                const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
                // Phase 1 is 0-50%
                const progress = 5 + Math.min(45, Math.floor((recordsProcessed / 7600000) * 45));

                const recordsPerMin = recordsProcessed / (parseFloat(elapsed) || 1);
                const recordsLeft = Math.max(0, 7600000 - recordsProcessed);
                const etaMin = Math.ceil(recordsLeft / (recordsPerMin || 1));

                job.summary = `Phase 1/2: Processed ${recordsProcessed.toLocaleString()} / 7.6M authors. (${progress}%). Created ${mappingsCreated.toLocaleString()} mappings. • ETA: ~${etaMin} min`;
                job.progress = progress;
                await job.save();
            }
        }
    }

    if (batchAuthors.length > 0) await insertAuthorBatch(batchAuthors);
    if (batchMappings.length > 0) await insertMappingBatch(batchMappings);

    await saveCheckpoint(job.id, 'mapping_complete', { lastPosition: lineNumber, recordsProcessed, mappingsCreated });
    job.summary = 'Phase 1/2 Complete: Database tables populated.';
    job.progress = 50;
    await job.save();
}

async function insertAuthorBatch(authors) {
    if (authors.length === 0) return;
    const values = authors.map(a => `(${sequelize.escape(a.author_id)}, ${sequelize.escape(a.name)})`).join(',');
    await sequelize.query(`
        INSERT INTO open_library_authors (author_id, name) 
        VALUES ${values}
        ON DUPLICATE KEY UPDATE name = VALUES(name)
    `, { logging: false });
}

async function insertMappingBatch(mappings) {
    if (mappings.length === 0) return;
    const values = mappings.map(m => `(${sequelize.escape(m.isbn)}, ${sequelize.escape(m.author_keys)})`).join(',');
    await sequelize.query(`
        INSERT INTO isbn_author_mappings (isbn, author_keys) 
        VALUES ${values}
        ON DUPLICATE KEY UPDATE author_keys = IF(
            FIND_IN_SET(VALUES(author_keys), author_keys) > 0, 
            author_keys, 
            CONCAT_WS(',', author_keys, VALUES(author_keys))
        )
    `, { logging: false });
}

async function updateBooksPhase(job, checkpoint) {
    console.log(`[Job ${job.id}] Phase 2: Updating books with Multi-Author Support`);
    job.summary = 'Phase 2/2: Resolving authors and updating books...';
    job.progress = 50;
    await job.save();

    const startTime = Date.now();
    let lastUpdate = Date.now();
    let booksUpdated = checkpoint?.booksUpdated || 0;
    let lastBookId = checkpoint?.lastBookId || 0;
    const BATCH_SIZE = 1000;

    // Get total count for progress estimation
    const [countResult] = await sequelize.query(`
        SELECT COUNT(*) as count FROM books 
        WHERE (author IS NULL OR author = '' OR author = 'Unknown')
        AND isbn IS NOT NULL AND isbn != ''
    `);
    const totalToFix = countResult[0].count;
    console.log(`[Job ${job.id}] Phase 2: ${totalToFix} books left to fix.`);

    while (true) {
        await job.reload();
        if (job.status !== 'running' || !activeJobs.has(job.id)) return;

        // 1. Fetch a batch of books needing repair
        const books = await Book.findAll({
            where: {
                id: { [Op.gt]: lastBookId },
                [Op.or]: [
                    { author: null },
                    { author: '' },
                    { author: 'Unknown' }
                ],
                isbn: { [Op.ne]: null, [Op.ne]: '' }
            },
            attributes: ['id', 'isbn'],
            limit: BATCH_SIZE,
            order: [['id', 'ASC']]
        });

        if (books.length === 0) break;

        const isbnsInBatch = books.map(b => b.isbn.replace(/[-\s]/g, ''));

        // 2. Fetch ISBN mappings for this batch
        const [mappings] = await sequelize.query(`
            SELECT isbn, author_keys FROM isbn_author_mappings 
            WHERE isbn IN (?)
        `, { replacements: [isbnsInBatch] });

        if (mappings.length > 0) {
            // 3. Collect and Resolve Unique Author Keys
            const mappingMap = new Map();
            const allAuthorKeys = new Set();
            mappings.forEach(m => {
                mappingMap.set(m.isbn, m.author_keys);
                m.author_keys.split(',').forEach(k => allAuthorKeys.add(k.replace('/authors/', '')));
            });

            const [authorRows] = await sequelize.query(`
                SELECT author_id, name FROM open_library_authors 
                WHERE author_id IN (?)
            `, { replacements: [Array.from(allAuthorKeys)] });

            const authorNameMap = new Map();
            authorRows.forEach(a => authorNameMap.set(a.author_id, a.name));

            // 4. Match and Build Update Data
            const updates = [];
            for (const book of books) {
                const cleanIsbn = book.isbn.replace(/[-\s]/g, '');
                const keysStr = mappingMap.get(cleanIsbn);
                if (keysStr) {
                    const names = keysStr.split(',')
                        .map(k => authorNameMap.get(k.replace('/authors/', '')))
                        .filter(Boolean);

                    if (names.length > 0) {
                        const fullAuthor = names.join(', ').substring(0, 255);
                        updates.push({ id: book.id, author: fullAuthor });
                    }
                }
            }

            // 5. Bulk Update via UPDATE CASE
            if (updates.length > 0) {
                const ids = updates.map(u => sequelize.escape(u.id)).join(',');
                const caseStatement = updates.map(u => `WHEN ${sequelize.escape(u.id)} THEN ${sequelize.escape(u.author)}`).join(' ');

                await sequelize.query(`
                    UPDATE books
                    SET author = CASE id ${caseStatement} ELSE author END,
                        updatedAt = NOW()
                    WHERE id IN (${ids})
                `, { logging: false });
                booksUpdated += updates.length;
            }
        }

        lastBookId = books[books.length - 1].id;
        if (booksUpdated > 0 && (Date.now() - lastUpdate > 4000 || booksUpdated % 5000 === 0)) {
            lastUpdate = Date.now();
            await saveCheckpoint(job.id, 'updating', { lastBookId, booksUpdated });

            const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
            // Phase 2 is 50-100%
            const progress = 50 + Math.min(49, Math.floor((booksUpdated / (totalToFix + booksUpdated || 1)) * 49));

            job.summary = `Phase 2/2 | Scanned: ${booksUpdated.toLocaleString()} | Updated: ${booksUpdated.toLocaleString()} | Total: ${(totalToFix + booksUpdated).toLocaleString()} books | (${progress}%)`;
            job.progress = progress;
            await job.save();
        }
    }

    console.log(`[Job ${job.id}] Phase 2 complete. Total authors repaired: ${booksUpdated}`);
}

function stopJob(jobId) { activeJobs.delete(jobId); }
function pauseJob(jobId) { activeJobs.delete(jobId); }
function resumeJob(jobId) { activeJobs.add(jobId); }

module.exports = { repairAuthorsStable, stopJob, pauseJob, resumeJob };
