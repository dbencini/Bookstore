const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { sequelize, Book, Job } = require('./models');
const { buildAuthorCache } = require('./build_author_cache');

/**
 * Repair Authors Using Open Library Data with Job Progress Tracking
 * Supports stop/pause/resume controls
 * NO API CALLS - Uses local dumps only!
 */

const activeJobs = new Set();

async function repairAuthorsWithProgress() {
    // Create job for progress tracking
    const job = await Job.create({
        type: 'author_repair_local',
        summary: 'Initializing author repair from local data...',
        startTime: new Date(),
        status: 'running',
        progress: 0
    });

    activeJobs.add(job.id);

    try {
        // Step 1: Build author cache
        console.log(`[Job ${job.id}] Starting Step 1: Build author cache`);
        job.summary = 'Step 1/4: Building author lookup cache from OpenLibraryAuthors.txt...';
        job.progress = 5;
        await job.save();

        const authorCache = await buildAuthorCache();

        // Check if stopped
        await job.reload();
        if (job.status !== 'running' || !activeJobs.has(job.id)) {
            return { success: false, jobId: job.id, stopped: true };
        }

        job.summary = `Step 1/4 Complete! Cached ${authorCache.size.toLocaleString()} authors.`;
        job.progress = 20;
        await job.save();
        console.log(`[Job ${job.id}] Step 1 complete: ${authorCache.size} authors cached`);

        // Step 2: Count books missing authors
        console.log(`[Job ${job.id}] Starting Step 2: Count missing authors`);
        job.summary = 'Step 2/4: Counting books with missing authors...';
        job.progress = 22;
        await job.save();

        await sequelize.authenticate();

        const [countResult] = await sequelize.query(`
            SELECT COUNT(*) as count 
            FROM books 
            WHERE (author IS NULL OR author = '' OR author = 'Unknown')
            AND isbn IS NOT NULL AND isbn != ''
        `);

        const totalMissing = countResult[0].count;

        if (totalMissing === 0) {
            job.status = 'completed';
            job.progress = 100;
            job.summary = 'No books need author repair!';
            job.endTime = new Date();
            await job.save();
            activeJobs.delete(job.id);
            await sequelize.close();
            return { success: true, jobId: job.id };
        }

        job.summary = `Step 2/4 Complete! Found ${totalMissing.toLocaleString()} books missing authors.`;
        job.progress = 25;
        await job.save();
        console.log(`[Job ${job.id}] Step 2 complete: ${totalMissing} books need authors`);

        // Step 3: Build ISBN -> Author Keys map from OpenLibraryBooks.txt
        console.log(`[Job ${job.id}] Starting Step 3: Scan OpenLibraryBooks.txt`);
        job.summary = 'Step 3/4: Mapping ISBNs to author keys from OpenLibraryBooks.txt...';
        job.progress = 30;
        await job.save();

        const booksPath = path.join(__dirname, 'uploads', 'OpenLibraryBooks.txt');

        if (!fs.existsSync(booksPath)) {
            throw new Error('OpenLibraryBooks.txt not found!');
        }

        const isbnToAuthorKeys = new Map();
        let booksProcessed = 0;
        let booksWithAuthors = 0;
        const startTime = Date.now();

        const fileStream = fs.createReadStream(booksPath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            // Check if job stopped/paused every 50k records
            if (booksProcessed % 50000 === 0) {
                await job.reload();
                if (job.status !== 'running' || !activeJobs.has(job.id)) {
                    fileStream.destroy();
                    rl.close();
                    return { success: false, jobId: job.id, stopped: true };
                }
            }

            booksProcessed++;

            // Keep existing scan-based updates at lower frequency
            if (booksProcessed % 50000 === 0) {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                const progress = 30 + Math.min(15, Math.floor((booksProcessed / 13000000) * 15));
                console.log(`[Job ${job.id}] Step 3: ${booksProcessed.toLocaleString()} scanned, ${booksWithAuthors.toLocaleString()} mapped (${elapsed}s)`);
            }

            try {
                const parts = line.split('\t');
                if (parts.length < 5) continue;

                const jsonData = parts[4];
                const record = JSON.parse(jsonData);

                // Extract ISBNs
                const isbns = [];
                if (record.isbn_13) isbns.push(...record.isbn_13);
                if (record.isbn_10) isbns.push(...record.isbn_10);

                // Extract author keys
                if (record.authors && record.authors.length > 0 && isbns.length > 0) {
                    const authorKeys = record.authors.map(a => {
                        if (typeof a === 'string') return a;
                        if (a.key) return a.key;
                        if (a.author && a.author.key) return a.author.key;
                        return null;
                    }).filter(k => k);

                    if (authorKeys.length > 0) {
                        isbns.forEach(isbn => {
                            isbnToAuthorKeys.set(isbn, authorKeys);
                        });
                        booksWithAuthors++;

                        // Update UI every 100k mapped books
                        if (booksWithAuthors % 100000 === 0) {
                            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                            const progress = 30 + Math.min(15, Math.floor((booksProcessed / 13000000) * 15));
                            job.summary = `Step 3/4: Scanned ${booksProcessed.toLocaleString()} records, MAPPED ${booksWithAuthors.toLocaleString()} with authors!`;
                            job.progress = progress;
                            await job.save();
                            console.log(`[Job ${job.id}] ✅ MAPPED MILESTONE: ${booksWithAuthors.toLocaleString()} books with authors!`);
                        }
                    }
                }
            } catch (err) {
                continue;
            }
        }

        const scanTime = ((Date.now() - startTime) / 1000).toFixed(1);
        job.summary = `Step 3/4 Complete! Scanned ${booksProcessed.toLocaleString()} records, mapped ${booksWithAuthors.toLocaleString()} ISBNs with authors.`;
        job.progress = 45;
        await job.save();
        console.log(`[Job ${job.id}] Step 3 complete: ${booksProcessed} scanned, ${booksWithAuthors} mapped`);

        // Step 4: Update database
        console.log(`[Job ${job.id}] Starting Step 4: Update database`);
        job.summary = 'Step 4/4: Updating database with resolved author names...';
        job.progress = 50;
        await job.save();

        const BATCH_SIZE = 1000;
        let lastId = 0; // Cursor-based - much faster!
        let totalUpdated = 0;
        let totalChecked = 0;
        const updateStartTime = Date.now();

        console.log(`[Job ${job.id}] Step 4: Starting database updates (FAST cursor mode)...`);
        console.log(`[Job ${job.id}] Step 4: Batch size = ${BATCH_SIZE}, will update ${totalMissing.toLocaleString()} books`);

        while (true) {
            // Check if job stopped/paused
            await job.reload();
            if (job.status !== 'running' || !activeJobs.has(job.id)) {
                return { success: false, jobId: job.id, stopped: true };
            }

            console.log(`[Job ${job.id}] Step 4: Fetching batch from ID ${lastId}...`);

            const books = await Book.findAll({
                where: {
                    id: { [sequelize.Sequelize.Op.gt]: lastId },
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

            console.log(`[Job ${job.id}] Step 4: Fetched ${books.length} books`);

            if (books.length === 0) {
                console.log(`[Job ${job.id}] Step 4: No more books to process`);
                break;
            }

            totalChecked += books.length;

            // Move cursor to last book ID in this batch
            lastId = books[books.length - 1].id;

            for (const book of books) {
                const authorKeys = isbnToAuthorKeys.get(book.isbn);

                if (authorKeys && authorKeys.length > 0) {
                    // Resolve author keys to names
                    const authorNames = authorKeys
                        .map(key => {
                            const authorId = key.replace('/authors/', '');
                            return authorCache.get(authorId);
                        })
                        .filter(name => name);

                    if (authorNames.length > 0) {
                        book.author = authorNames.join(', ').substring(0, 2000);
                        await book.save();
                        totalUpdated++;
                    }
                }
            }

            offset += BATCH_SIZE;

            // Update progress every 1000 books (changed from 5000)
            if (totalUpdated % 1000 === 0 && totalUpdated > 0) {
                const elapsed = ((Date.now() - updateStartTime) / 1000 / 60).toFixed(1);
                const progress = 50 + Math.min(45, Math.floor((totalUpdated / totalMissing) * 45));
                job.summary = `Step 4/4: Updated ${totalUpdated.toLocaleString()} / ${totalMissing.toLocaleString()} books (${elapsed} min elapsed)`;
                job.progress = progress;
                await job.save();
                console.log(`[Job ${job.id}] Step 4: ${totalUpdated.toLocaleString()} / ${totalMissing.toLocaleString()} updated (${elapsed} min)`);
            }
        }

        const totalTime = ((Date.now() - updateStartTime) / 1000 / 60).toFixed(1);

        job.status = 'completed';
        job.progress = 100;
        job.summary = `✅ Complete! Added authors to ${totalUpdated.toLocaleString()} books in ${totalTime} minutes.`;
        job.endTime = new Date();
        await job.save();

        activeJobs.delete(job.id);
        await sequelize.close();

        return { success: true, jobId: job.id, updated: totalUpdated };

    } catch (err) {
        console.error('[Author Repair] Error:', err);
        job.status = 'failed';
        job.summary = `Failed: ${err.message}`;
        job.endTime = new Date();
        await job.save();
        activeJobs.delete(job.id);
        throw err;
    }
}

// Job control functions
async function stopJob(jobId) {
    const job = await Job.findByPk(jobId);
    if (!job) return { success: false, message: `Job ${jobId} not found.` };

    if (activeJobs.has(jobId)) activeJobs.delete(jobId);

    job.status = 'stopped';
    job.summary = 'Job stopped by user.';
    job.endTime = new Date();
    await job.save();
    return { success: true, message: `Job ${jobId} stopped.` };
}

async function pauseJob(jobId) {
    const job = await Job.findByPk(jobId);
    if (!job) return { success: false, message: `Job ${jobId} not found.` };

    if (activeJobs.has(jobId)) activeJobs.delete(jobId);

    job.status = 'paused';
    job.summary = `Paused by user. (Current progress: ${job.progress}%)`;
    await job.save();
    return { success: true, message: `Job ${jobId} paused.` };
}

async function resumeJob(jobId) {
    const job = await Job.findByPk(jobId);
    if (job && (job.status === 'paused' || job.status === 'running')) {
        job.status = 'running';
        await job.save();
        activeJobs.add(jobId);

        // Resume the repair
        repairAuthorsWithProgress().catch(err => console.error('[Author Repair] Resume error:', err));

        return { success: true, message: `Job ${jobId} resumed.` };
    }
    return { success: false, message: `Job ${jobId} not found or not in a resumable state.` };
}

module.exports = {
    repairAuthorsWithProgress,
    stopJob,
    pauseJob,
    resumeJob
};
