const axios = require('axios');
const { Book, Job, sequelize } = require('./models');
const { Op } = require('sequelize');
require('dotenv').config();

const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes';
const BATCH_SIZE = 10;
const DELAY_BETWEEN_REQUESTS = 3000; // 3 seconds to be safe without key, can be lowered with key
const MAX_CONSECUTIVE_ERRORS = 5;

async function axiosWithRetry(url, config, retries = 3, delay = 5000) {
    try {
        return await axios.get(url, config);
    } catch (err) {
        if (retries > 0 && err.response && err.response.status === 429) {
            console.log(`[RepairAuthors] Rate limited (429). Retrying in ${delay / 1000}s... (${retries} retries left)`);
            await new Promise(r => setTimeout(r, delay));
            return axiosWithRetry(url, config, retries - 1, delay * 2);
        }
        throw err;
    }
}

async function runRepair() {
    const apiKey = process.env.GOOGLE_BOOK_API;
    if (!apiKey) {
        console.warn("\n[WARNING] GOOGLE_BOOK_API is missing from .env. Enrichment will be severely rate-limited.\n");
    }

    console.log("[RepairAuthors] Identifying books with missing authors but existing ISBNs...");

    const where = {
        [Op.or]: [
            { author: { [Op.or]: [null, '', 'Unknown'] } },
            { author: 'Unknown' }
        ],
        isbn: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
    };

    const totalToFix = await Book.count({ where });
    console.log(`[RepairAuthors] Found ${totalToFix.toLocaleString()} books needing repair.`);

    if (totalToFix === 0) {
        console.log("[RepairAuthors] No books found requiring author repair.");
        process.exit(0);
    }

    const job = await Job.create({
        type: 'author_repair',
        summary: `Started: Targeting ${totalToFix.toLocaleString()} books.`,
        startTime: new Date(),
        status: 'running',
        progress: 0
    });

    let processedCount = 0;
    let fixedCount = 0;
    let errorCount = 0;
    let consecutiveErrors = 0;

    try {
        while (processedCount < totalToFix) {
            const books = await Book.findAll({
                where,
                limit: BATCH_SIZE,
                order: [['id', 'ASC']]
            });

            if (books.length === 0) break;

            for (const book of books) {
                try {
                    console.log(`[${processedCount + 1}/${totalToFix}] Repairing: ${book.title} (ISBN: ${book.isbn})`);

                    const response = await axiosWithRetry(GOOGLE_BOOKS_API_URL, {
                        params: {
                            q: `isbn:${book.isbn}`,
                            maxResults: 1,
                            key: apiKey
                        }
                    });

                    const items = response.data.items || [];
                    if (items.length > 0) {
                        const info = items[0].volumeInfo;
                        if (info.authors && info.authors.length > 0) {
                            book.author = info.authors.join(', ').substring(0, 255);
                            await book.save();
                            fixedCount++;
                            console.log(`   - FIXED: ${book.author}`);
                        } else {
                            console.log(`   - No author found in API result.`);
                        }
                    } else {
                        console.log(`   - ISBN not found in Google Books.`);
                    }

                    consecutiveErrors = 0;
                    await new Promise(r => setTimeout(r, DELAY_BETWEEN_REQUESTS));

                } catch (err) {
                    errorCount++;
                    consecutiveErrors++;
                    console.error(`   - ERROR: ${err.message}`);
                    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                        throw new Error(`Stopped due to ${MAX_CONSECUTIVE_ERRORS} consecutive errors. Possible rate limit or API issue.`);
                    }
                }

                processedCount++;
                if (processedCount % 5 === 0) {
                    job.progress = Math.round((processedCount / totalToFix) * 100);
                    job.summary = `Processed ${processedCount.toLocaleString()}. Fixed: ${fixedCount}. Errors: ${errorCount}.`;
                    await job.save();
                }
            }
        }

        job.status = 'completed';
        job.summary = `Completed! Processed ${processedCount}, Fixed ${fixedCount}, Errors ${errorCount}.`;
        job.endTime = new Date();
        await job.save();
        console.log(`\n[RepairAuthors] FINISHED. Fixed ${fixedCount} books.`);

    } catch (fatalErr) {
        console.error(`[RepairAuthors] FATAL ERROR: ${fatalErr.message}`);
        job.status = 'failed';
        job.summary = `Fatal: ${fatalErr.message}. Progress: ${processedCount}/${totalToFix}`;
        job.endTime = new Date();
        await job.save();
    }

    process.exit(0);
}

runRepair();
