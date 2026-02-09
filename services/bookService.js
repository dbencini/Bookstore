const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const unzipper = require('unzipper');
const zlib = require('zlib');
const readline = require('readline');
const { Book, Job, Category, BookCategory, sequelize } = require('../models');
const { Op } = require('sequelize');

// Configure Google Books API URL
const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes';

// Track active jobs for cancellation
const activeJobs = new Set();

function cancelJob(jobId) {
    if (activeJobs.has(jobId)) {
        activeJobs.delete(jobId);
        console.log(`[BookService] Cancellation requested for Job ${jobId}`);
        return true;
    }
    return false;
}

async function fetchGoogleBooks(query = 'subject:fiction') {
    let job;
    try {
        console.log(`[BookService] Fetching books for query: ${query}...`);

        job = await Job.create({
            type: 'manual_import',
            summary: `Query: ${query}`,
            startTime: new Date()
        });

        activeJobs.add(job.id);

        const response = await axios.get(GOOGLE_BOOKS_API_URL, {
            params: {
                q: query,
                maxResults: 10,
                key: process.env.GOOGLE_BOOK_API
            }
        });

        const items = response.data.items || [];
        console.log(`[BookService] Found ${items.length} books.`);

        let addedCount = 0;
        for (const item of items) {
            // Check Cancellation
            if (!activeJobs.has(job.id)) {
                console.log(`[BookService] Job ${job.id} cancelled by user.`);
                job.status = 'stopped';
                break;
            }

            const info = item.volumeInfo;

            // STRICT FILTER: Skip books without title, authors, description, or image
            if (!info.title || !info.authors || !info.description) continue;
            if (!info.imageLinks || (!info.imageLinks.thumbnail && !info.imageLinks.smallThumbnail)) continue;

            // Extract ISBN (prefer ISBN-13)
            let isbn = null;
            if (info.industryIdentifiers) {
                const isbn13 = info.industryIdentifiers.find(id => id.type === 'ISBN_13');
                const isbn10 = info.industryIdentifiers.find(id => id.type === 'ISBN_10');
                if (isbn13) isbn = isbn13.identifier;
                else if (isbn10) isbn = isbn10.identifier;
            }

            const bookData = {
                title: (info.title || 'Unknown Title').substring(0, 255),
                author: (info.authors ? info.authors.join(', ') : 'Unknown').substring(0, 2000),
                description: (info.description || 'No description available.').substring(0, 4000),
                price: 19.99,
                imageUrl: (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail || '/images/default_cover.svg').substring(0, 255),
                isbn: isbn,
                JobId: job.id
            };

            // Dynamic Category Handling
            let activeCategoryId = null;
            const curatedCategories = await Category.findAll({ where: { subject_triggers: { [Op.ne]: null } } });
            const [defaultCat] = await Category.findOrCreate({ where: { name: 'New Books' } });

            if (info.categories && info.categories.length > 0) {
                const primarySubject = info.categories[0].toLowerCase();
                for (const cat of curatedCategories) {
                    const triggers = cat.subject_triggers.split(',').map(tr => tr.trim().toLowerCase());
                    if (triggers.some(tr => primarySubject.includes(tr))) {
                        activeCategoryId = cat.id;
                        break;
                    }
                }
            }
            if (!activeCategoryId) activeCategoryId = defaultCat.id;

            const existing = await Book.findOne({ where: { title: bookData.title } });
            if (!existing) {
                const book = await Book.create(bookData);
                if (activeCategoryId) {
                    await BookCategory.create({ BookId: book.id, CategoryId: activeCategoryId });
                }
                addedCount++;
            }
        }

        if (activeJobs.has(job.id)) {
            job.status = 'completed';
            activeJobs.delete(job.id);
        }

        job.booksAdded = addedCount;
        job.endTime = new Date();
        await job.save();

        console.log(`[BookService] Added ${addedCount} new books.`);
        return { success: true, added: addedCount, jobId: job.id };
    } catch (error) {
        console.error('[BookService] Error fetching books:', error.message);
        if (job) {
            job.status = 'failed';
            job.summary += ` | Error: ${error.message}`;
            job.endTime = new Date();
            await job.save();
        }
        return { success: false, error: error.message };
    }
}

async function fixBookData() {
    const job = await Job.create({
        type: 'data_repair',
        summary: 'Initializing data repair job...',
        startTime: new Date(),
        status: 'running',
        progress: 0
    });

    activeJobs.add(job.id);

    // Run in background
    processDataRepairBackground(job).catch(err => {
        console.error('[BookService] Fatal Data Repair Error:', err);
    });

    return { success: true, jobId: job.id };
}

async function axiosWithRetry(url, config, retries = 5, delay = 5000) {
    try {
        return await axios.get(url, config);
    } catch (err) {
        if (err.response && err.response.status === 429) {
            if (retries > 0) {
                console.log(`[BookService] Rate limited (429). Retrying in ${delay}ms... (${retries} retries left)`);
                await new Promise(r => setTimeout(r, delay));
                return axiosWithRetry(url, config, retries - 1, delay * 2);
            } else {
                console.error(`[BookService] Rate limit (429) persists after multiple retries. API key likely required.`);
            }
        }
        throw err;
    }
}

async function processDataRepairBackground(job) {
    let processedCount = job.processedCount || 0;
    let fixedCount = job.fixedCount || 0;
    let removedCount = job.removedCount || 0;
    let lastFixedIsbns = [];

    try {
        const apiKey = process.env.GOOGLE_BOOK_API;
        console.log(`[BookService] [Background] Starting Refined Data Repair Job ${job.id} at ID: ${job.lastProcessedId || 'START'}`);
        if (!apiKey) {
            console.warn("[BookService] [Background] WARNING: GOOGLE_BOOK_API is missing. Enrichment will be severely rate-limited.");
        }

        const baseWhere = {
            isbn: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }, // Only repair if we have an ISBN
            [Op.or]: [
                { description: { [Op.or]: [null, '', 'No description available.'] } },
                { author: { [Op.or]: [null, '', 'Unknown'] } },
                { imageUrl: { [Op.or]: [null, '', { [Op.like]: '%placehold.co%' }, { [Op.like]: '%default_cover.svg%' }, { [Op.like]: '%placeholder-book.png%' }] } }
            ]
        };

        const totalToFix = await Book.count({ where: baseWhere });
        console.log(`[BookService] Identified ${totalToFix.toLocaleString()} books with ISBNs needing repair.`);

        if (job.status !== 'paused') {
            const warning = !apiKey ? " (WARNING: No API Key)" : "";
            job.summary = `Identified ${totalToFix.toLocaleString()} books with ISBNs.${warning} Initializing prioritized repair...`;
            await job.save();
        }

        if (totalToFix === 0 && !job.lastProcessedId) {
            job.status = 'completed';
            job.progress = 100;
            job.summary = 'No books with ISBNs found needing repair.';
            job.endTime = new Date();
            await job.save();
            activeJobs.delete(job.id);
            return;
        }

        const BATCH_SIZE = 25; // Smaller batches for stealth

        while (true) {
            await job.reload();
            if (!activeJobs.has(job.id)) {
                console.log(`[BookService] Repair Job ${job.id} is no longer active (Status: ${job.status}).`);
                break;
            }

            const books = await Book.findAll({
                where: baseWhere,
                limit: BATCH_SIZE,
                // Prioritize by stock (bestsellers/popularity proxy)
                order: [['stock', 'DESC'], ['id', 'ASC']]
            });

            // If we are resuming, we might need to skip already processed ones if they still match baseWhere
            // But since we are updating them, they should drop out of baseWhere naturally.

            if (books.length === 0) break;

            console.log(`[BookService] Processing batch of ${books.length} priority books...`);

            for (const book of books) {
                if (!activeJobs.has(job.id)) break;

                processedCount++;

                try {
                    // Item Delay: 3s between individual calls
                    await new Promise(r => setTimeout(r, 3000));

                    const query = `isbn:${book.isbn}`;
                    const response = await axiosWithRetry(GOOGLE_BOOKS_API_URL, {
                        params: {
                            q: query,
                            maxResults: 1,
                            key: process.env.GOOGLE_BOOK_API
                        }
                    });

                    const items = response.data.items || [];
                    if (items.length > 0) {
                        const info = items[0].volumeInfo;
                        let updated = false;

                        if ((!book.description || book.description === 'No description available.') && info.description) {
                            book.description = info.description.substring(0, 4000);
                            updated = true;
                        }

                        if ((!book.author || book.author === 'Unknown') && info.authors && info.authors.length > 0) {
                            book.author = info.authors.join(', ').substring(0, 2000);
                            updated = true;
                        }

                        const newImageUrl = info.imageLinks ? (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail) : null;
                        if (newImageUrl) {
                            const cleanNewImage = newImageUrl.substring(0, 255);
                            if (book.imageUrl !== cleanNewImage) {
                                book.imageUrl = cleanNewImage;
                                updated = true;
                            }
                        }

                        if (updated) {
                            book.JobId = job.id;
                            await book.save();
                            fixedCount++;
                        }

                        // Category Enrichment (if book has no categories)
                        const currentCatCount = await BookCategory.count({ where: { BookId: book.id } });
                        if (currentCatCount === 0 && info.categories && info.categories.length > 0) {
                            const catIds = [];
                            for (const catName of info.categories.slice(0, 5)) {
                                const [cat] = await Category.findOrCreate({ where: { name: catName.substring(0, 255) } });
                                catIds.push(cat.id);
                            }

                            if (catIds.length > 0) {
                                const links = catIds.map(cid => ({ BookId: book.id, CategoryId: cid }));
                                await BookCategory.bulkCreate(links, { ignoreDuplicates: true });
                            }
                        }

                        lastFixedIsbns.push(book.isbn);
                        if (lastFixedIsbns.length > 3) lastFixedIsbns.shift();
                    } else {
                        // If ISBN lookup fails, we mark it so we don't try again or destroy if it's junk
                        if ((!book.description || book.description === 'No description available.') &&
                            (!book.imageUrl || book.imageUrl.includes('placehold.co'))) {
                            // We don't destroy immediately here as ISBN might just be not found in Google
                            // but we could set an "unfixable" flag if we had one.
                        }
                    }
                } catch (apiErr) {
                    console.warn(`[BookService] API Error fixing ISBN ${book.isbn}: ${apiErr.message}`);
                    if (apiErr.response && apiErr.response.status === 429) {
                        // Heavy wait on 429
                        await new Promise(r => setTimeout(r, 60000));
                    }
                }

                // Update job progress
                job.lastProcessedId = book.id;
                job.processedCount = processedCount;
                job.fixedCount = fixedCount;
                job.removedCount = removedCount;

                if (processedCount % 5 === 0) {
                    const progress = Math.min(99, Math.round((processedCount / (processedCount + (totalToFix - processedCount))) * 100));
                    job.progress = progress;
                    let exampleText = lastFixedIsbns.length > 0 ? ` For example ${lastFixedIsbns.join(', ')}` : '';
                    job.summary = `Repairing Priority Books: ${processedCount.toLocaleString()} processed. Fixed: ${fixedCount}.${exampleText}`;
                    await job.save();
                }
            }

            // Batch Delay: 30s pause between batches to breathe
            if (activeJobs.has(job.id)) {
                console.log(`[BookService] Batch complete. Waiting 30s to stay under rate limits...`);
                await new Promise(r => setTimeout(r, 30000));
            }
        }

        if (activeJobs.has(job.id)) {
            job.status = 'completed';
            job.progress = 100;
            job.endTime = new Date();
            job.summary = `Completed! Processed ${processedCount.toLocaleString()} priority books. Fixed ${fixedCount}.`;
            await job.save();
            activeJobs.delete(job.id);
        }

    } catch (error) {
        console.error(`[BookService] Refined Data Repair ${job.id} Failed:`, error.message);
        if (job) {
            job.status = 'failed';
            job.summary = `Failed: ${error.message}`;
            job.endTime = new Date();
            await job.save();
            activeJobs.delete(job.id);
        }
    }
}

async function importBooksFromCSV(filePath, markup = 0, originalName = null) {
    // Initial Job Creation
    const job = await Job.create({
        type: 'csv_import',
        summary: `Initializing: ${originalName || path.basename(filePath)} | Markup: ${markup}%`,
        startTime: new Date(),
        status: 'running',
        progress: 0
    });

    activeJobs.add(job.id);

    // Run the actual ingestion in the background
    processImportBackground(job, filePath, markup, originalName).catch(err => {
        console.error('[BookService] Fatal Background Import Error:', err);
    });

    return { success: true, jobId: job.id };
}

async function importManualZip(markup = 0) {
    const uploadsDir = path.join(__dirname, '../uploads');
    const zipPath = path.join(uploadsDir, 'library.zip');

    if (!fs.existsSync(zipPath)) {
        throw new Error('library.zip not found in uploads folder.');
    }

    const job = await Job.create({
        type: 'manual_zip_import',
        summary: `Initializing manual import from library.zip | Markup: ${markup}%`,
        startTime: new Date(),
        status: 'running',
        progress: 0
    });

    // We don't delete library.zip immediately in manual mode, but the processImportBackground might.
    // Actually, processImportBackground deletes the filePath at the end.
    // So we should probably copy it or handle the deletion carefully.
    // User said "manually copying the zip file into that folder", so they might want to keep it?
    // But usually imports consume the file. Let's keep the standard behavior but maybe rename it to avoid conflict.

    activeJobs.add(job.id);

    // Process it
    processImportBackground(job, zipPath, markup, 'library.zip').catch(err => {
        console.error('[BookService] Fatal Manual Zip Import Error:', err);
    });

    return { success: true, jobId: job.id };
}

async function processImportBackground(job, filePath, markup, originalName = null) {
    let tempDir = null;
    let rowCount = 0;
    let addedCount = 0;
    let updatedCount = 0;
    let totalDetectedRows = 0;

    try {
        console.log(`[BookService] [Background] Starting Import Job ${job.id}...`);
        let targetCsvPath = filePath;

        // ZIP Support
        const isZip = (filePath.toLowerCase().endsWith('.zip')) ||
            (originalName && originalName.toLowerCase().endsWith('.zip'));

        if (isZip) {
            console.log(`[BookService] [Background] ZIP detected. Extracting...`);
            tempDir = path.join(path.dirname(filePath), `extract_${Date.now()}`);
            fs.mkdirSync(tempDir, { recursive: true });

            const zip = fs.createReadStream(filePath).pipe(unzipper.Parse({ forceStream: true }));
            let csvFound = false;

            for await (const entry of zip) {
                const fileName = entry.path;
                if (!csvFound && fileName.toLowerCase().endsWith('.csv')) {
                    csvFound = true;
                    targetCsvPath = path.join(tempDir, path.basename(fileName));
                    const writeStream = fs.createWriteStream(targetCsvPath);
                    await new Promise((resolve, reject) => {
                        entry.pipe(writeStream);
                        writeStream.on('finish', resolve);
                        writeStream.on('error', reject);
                    });
                } else {
                    entry.autodrain();
                }
            }
            if (!csvFound) throw new Error('No .csv file found inside ZIP.');
        }

        // 1. PRE-SCAN for Row Count
        console.log(`[BookService] Pre-scanning CSV for row count...`);
        job.summary = "Counting rows...";
        await job.save();

        totalDetectedRows = await new Promise((resolve, reject) => {
            let count = 0;
            fs.createReadStream(targetCsvPath)
                .pipe(csv())
                .on('data', () => count++)
                .on('end', () => resolve(count))
                .on('error', reject);
        });

        console.log(`[BookService] Detected ${totalDetectedRows.toLocaleString()} rows.`);
        job.summary = `Detected ${totalDetectedRows.toLocaleString()} rows. Starting ingestion...`;
        await job.save();

        // 2. BATCHED INGESTION
        const BATCH_SIZE = 500;
        let batch = [];

        const stream = fs.createReadStream(targetCsvPath).pipe(csv({
            mapHeaders: ({ header }) => header.replace(/^[^\w]+/, '').toLowerCase().trim()
        }));

        for await (const row of stream) {
            rowCount++;
            batch.push(row);

            if (batch.length >= BATCH_SIZE) {
                const result = await processBatch(batch, job, markup);
                addedCount += result.added;
                updatedCount += result.updated;
                batch = [];

                // Update Progress
                const progress = Math.min(99, Math.round((rowCount / totalDetectedRows) * 100));
                job.progress = progress;
                job.summary = `Ingesting... Scanned ${rowCount.toLocaleString()} / ${totalDetectedRows.toLocaleString()} rows. Added ${addedCount}, Updated ${updatedCount}.`;
                await job.save();
            }
        }

        // Final batch
        if (batch.length > 0) {
            const result = await processBatch(batch, job, markup);
            addedCount += result.added;
            updatedCount += result.updated;
        }

        job.status = 'completed';
        job.progress = 100;
        job.booksAdded = addedCount;
        job.endTime = new Date();
        job.summary = `Completed! Processed ${rowCount.toLocaleString()} rows. Added ${addedCount} new, Updated ${updatedCount}.`;
        await job.save();

        activeJobs.delete(job.id);
        console.log(`[BookService] Import ${job.id} Complete. Total: ${rowCount}, Added: ${addedCount}, Updated: ${updatedCount}`);
    } catch (error) {
        console.error(`[BookService] Import ${job.id} Failed:`, error.message);
        if (job) {
            job.status = 'failed';
            job.summary = `Failed: ${error.message} (At row ${rowCount})`;
            job.endTime = new Date();
            await job.save();
        }
    } finally {
        activeJobs.delete(job.id);
        if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
}

async function processBatch(rows, job, markup) {
    let added = 0;
    let updated = 0;

    // 1. Pre-fetch Categories
    const categoryNames = [...new Set(rows.map(r => r.category || 'New Books'))];
    const categoryMap = {};
    for (const name of categoryNames) {
        const [cat] = await Category.findOrCreate({ where: { name } });
        categoryMap[name] = cat.id;
    }

    // 2. Pre-fetch Existing Books in this batch
    const isbns = rows.map(r => r.isbn || r.code || r.id || r.barcode).filter(Boolean);
    const titles = rows.map(r => r.title || r.heading || r.name || r.item || r.book).filter(Boolean);

    const existingBooks = await Book.findAll({
        where: {
            [Op.or]: [
                { isbn: { [Op.in]: isbns } },
                { title: { [Op.in]: titles } }
            ]
        },
        attributes: ['id', 'isbn', 'title']
    });

    const existingMap = new Map();
    existingBooks.forEach(b => {
        if (b.isbn) existingMap.set(`isbn:${b.isbn}`, b.id);
        existingMap.set(`title:${b.title}`, b.id);
    });

    // 3. Process Batch in Transaction
    await sequelize.transaction(async (t) => {
        for (const row of rows) {
            const title = row.title || row.heading || row.name || row.item || row.book;
            const isbn = row.isbn || row.code || row.id || row.barcode;
            const status = (row.status || '').toLowerCase().trim();

            // Strictly filter by 'ready' status as requested
            if (status && status !== 'ready') continue;
            if (!title && !isbn) continue;

            const costVal = row.price_cost || row.cost || row.price;
            const cost = parseFloat(costVal) || 0;
            const finalPrice = cost * (1 + parseFloat(markup) / 100);

            const bookData = {
                title: (title || 'Unknown Title').substring(0, 255),
                author: (row.author || 'Unknown').substring(0, 2000),
                description: (row.description || row.summary || 'No description available.').substring(0, 4000),
                price: finalPrice || 19.99,
                price_cost: cost,
                imageUrl: (row.imageurl || row.image || '/images/default_cover.svg').substring(0, 255),
                isbn: isbn || null,
                status: status || 'ready', // Default to ready if we got this far
                bind: row.bind || null,
                pur: row.pur || row.bind || null,
                isVisible: (
                    (row.description || row.summary || 'No description available.') !== 'No description available.' &&
                    (row.author || 'Unknown') !== 'Unknown' &&
                    (row.author || 'Unknown').trim() !== ''
                ),
                JobId: job.id
            };

            // Deduplication Strategy: ISBN priority, Title fallback
            let existingId = null;
            if (isbn) {
                existingId = existingMap.get(`isbn:${isbn}`);
            } else if (title) {
                existingId = existingMap.get(`title:${title}`);
            }

            if (!existingId) {
                const book = await Book.create(bookData, { transaction: t });
                const catId = categoryMap[row.category || 'New Books'];
                if (catId) {
                    await BookCategory.create({ BookId: book.id, CategoryId: catId }, { transaction: t });
                }
                added++;
            } else {
                await Book.update(bookData, {
                    where: { id: existingId },
                    transaction: t
                });
                const catId = categoryMap[row.category || 'New Books'];
                if (catId) {
                    await BookCategory.findOrCreate({
                        where: { BookId: existingId, CategoryId: catId },
                        transaction: t
                    });
                }
                updated++;
            }
        }
    });

    return { added, updated };
}

// Function to handle job status changes
async function stopJob(jobId) {
    const job = await Job.findByPk(jobId);
    if (!job) return { success: false, message: `Job ${jobId} not found.` };

    if (activeJobs.has(jobId)) activeJobs.delete(jobId);

    job.status = 'stopped';
    job.summary = 'Job stopped by user (Dismissed).';
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
        // If it was 'running' but NOT in activeJobs, it's a resume after reboot/crash
        job.status = 'running';
        await job.save();
        activeJobs.add(jobId);

        if (job.type === 'data_fix' || job.type === 'data_repair') {
            processDataRepairBackground(job).catch(err => console.error(err));
        } else if (job.type === 'ultimate_repair') {
            runUltimateRepair(job).catch(err => console.error(err));
        } else {
            // Note: resuming imports is harder because of filePath requirements
            return { success: false, message: 'Resuming manual imports is not supported yet.' };
        }
        return { success: true, message: `Job ${jobId} resumed.` };
    }
    return { success: false, message: `Job ${jobId} not found or not in a resumable state.` };
}

async function startUltimateRepair() {
    // We check for a running or paused ultimate repair job first
    const existingJob = await Job.findOne({
        where: {
            type: 'ultimate_repair',
            status: { [Op.in]: ['running', 'paused'] }
        }
    });

    // If a job exists, we don't start a new one, but we might want to return that ID so the UI can re-attach
    if (existingJob) {
        return {
            success: false,
            message: `An ultimate repair job is already ${existingJob.status}.`,
            jobId: existingJob.id
        };
    }

    const job = await Job.create({
        type: 'ultimate_repair',
        summary: 'Initializing Ultimate Data Repair (Open Library Bulk)...',
        startTime: new Date(),
        status: 'running',
        progress: 0
    });

    activeJobs.add(job.id);

    // Run in background
    runUltimateRepair(job).catch(err => {
        console.error('[BookService] Fatal Ultimate Repair Error:', err);
    });

    return { success: true, jobId: job.id };
}

async function runUltimateRepair(job) {
    const dumpUrl = 'https://openlibrary.org/data/ol_dump_editions_latest.txt.gz';
    const dumpPath = path.join(__dirname, '../uploads/ol_dump_editions.txt.gz');
    let processedCount = 0;
    let fixedCount = 0;

    try {
        // 1. Detect Dump File (Prioritize unzipped for speed)
        const unzippedPaths = [
            path.join(__dirname, '../uploads/GoogleHugeFile.txt'),
            path.join(__dirname, '../uploads/ol_dump_editions.txt')
        ];

        let activePath = dumpPath; // Default to compressed
        let isCompressed = true;

        const existingUnzipped = unzippedPaths.find(p => fs.existsSync(p));
        if (existingUnzipped) {
            activePath = existingUnzipped;
            isCompressed = false;
            console.log(`[BookService] [Ultimate] Using unzipped dump: ${path.basename(activePath)}`);
        } else {
            // Download logic if no file exists
            if (!fs.existsSync(dumpPath)) {
                job.summary = 'Downloading Open Library Data Dump (this may take a while)...';
                await job.save();
                await downloadOpenLibraryDump(dumpUrl, dumpPath, job);
            } else {
                const stats = fs.statSync(dumpPath);
                try {
                    const head = await axios.head(dumpUrl);
                    const serverSize = parseInt(head.headers['content-length']);
                    if (serverSize && stats.size < serverSize) {
                        console.log(`[BookService] [Ultimate] Existing dump is incomplete. Resuming download...`);
                        job.summary = 'Resuming incomplete download...';
                        await job.save();
                        await downloadOpenLibraryDump(dumpUrl, dumpPath, job);
                    }
                } catch (e) { /* fallback to size check if HEAD fails */ }
            }
        }

        // 2. Load all ISBNs needing repair into Memory
        console.log('[BookService] [Ultimate] Loading ISBNs needing repair into memory...');
        job.summary = 'Indexing library ISBNs...';
        await job.save();

        // Optimized indexing: Fetch total count first
        const totalToIndex = await Book.count({
            where: {
                isbn: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
                [Op.or]: [
                    { description: { [Op.or]: [null, '', 'No description available.'] } },
                    { author: { [Op.or]: [null, '', 'Unknown'] } },
                    { imageUrl: { [Op.or]: [null, '', { [Op.like]: '%placehold.co%' }, { [Op.like]: '%default_cover.svg%' }] } }
                ]
            }
        });

        console.log(`[BookService] [Ultimate] Fetching ${totalToIndex.toLocaleString()} books for indexing...`);
        job.summary = `Loading ${totalToIndex.toLocaleString()} ISBNs into memory...`;
        await job.save();

        const booksToFix = await Book.findAll({
            where: {
                isbn: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
                [Op.or]: [
                    { description: { [Op.or]: [null, '', 'No description available.'] } },
                    { author: { [Op.or]: [null, '', 'Unknown'] } },
                    { imageUrl: { [Op.or]: [null, '', { [Op.like]: '%placehold.co%' }, { [Op.like]: '%default_cover.svg%' }] } }
                ]
            },
            attributes: ['id', 'isbn', 'description', 'author', 'imageUrl'],
            raw: true // Raw for speed
        });

        const isbnMap = new Map();
        let indexCount = 0;
        for (const b of booksToFix) {
            if (!activeJobs.has(job.id)) {
                console.log('[BookService] Ultimate Repair indexing stopped by user.');
                return; // Exit indexing
            }
            indexCount++;
            const clean = b.isbn.replace(/[-\s]/g, '');
            isbnMap.set(clean, {
                id: b.id,
                isbn: clean,
                needsDesc: !b.description || b.description === '' || b.description === 'No description available.',
                needsAuthor: !b.author || b.author === '' || b.author === 'Unknown',
                needsImage: !b.imageUrl || b.imageUrl === '' || b.imageUrl.includes('placehold.co') || b.imageUrl.includes('default_cover.svg')
            });

            // UPDATE UI FREQUENTLY (every 10k)
            if (indexCount % 10000 === 0) {
                job.summary = `Indexing ISBNs: ${indexCount.toLocaleString()} / ${totalToIndex.toLocaleString()}...`;
                job.progress = Math.floor((indexCount / totalToIndex) * 10); // Use 0-10% for indexing phase
                await job.save();
            }
        }

        console.log(`[BookService] [Ultimate] Ready to match ${isbnMap.size} unique ISBNs.`);
        job.summary = `Scanned 0 OL records. Enriched 0 books.`;
        await job.save();

        // 3. Stream and Match with Progress tracking
        const fileStats = fs.statSync(activePath);
        const totalBytes = fileStats.size;
        let bytesRead = 0;

        const fileStream = fs.createReadStream(activePath);

        let inputStream = fileStream;
        if (isCompressed) {
            inputStream = fileStream.pipe(zlib.createGunzip());
        }

        const rl = readline.createInterface({
            input: inputStream,
            crlfDelay: Infinity
        });

        let lineCount = 0;
        let batchUpdates = [];

        fileStream.on('data', (chunk) => {
            bytesRead += chunk.length;
            if (lineCount % 20000 === 0) {
                const p = 10 + Math.floor((bytesRead / totalBytes) * 90);
                job.progress = p;
                job.summary = `Scanned ${lineCount.toLocaleString()} records. Found ${fixedCount.toLocaleString()} matches. (${p}% of file)`;
                job.save().catch(() => { });
            }
        });

        for await (const line of rl) {
            if (!activeJobs.has(job.id)) {
                console.log('[BookService] Ultimate Repair stopped by user.');
                break;
            }

            lineCount++;
            const parts = line.split('\t');
            if (parts.length < 5) continue;

            try {
                const data = JSON.parse(parts[4]);
                const isbns = [];
                if (data.isbn_13) isbns.push(...data.isbn_13);
                if (data.isbn_10) isbns.push(...data.isbn_10);

                let match = null;
                for (let isbn of isbns) {
                    const clean = isbn.replace(/[-\s]/g, '');
                    if (isbnMap.has(clean)) {
                        match = isbnMap.get(clean);
                        break;
                    }
                }

                if (match) {
                    const updateData = {};
                    let updated = false;

                    // Description Matching
                    if (match.needsDesc && data.description) {
                        let desc = typeof data.description === 'string' ? data.description : data.description.value;
                        if (desc && desc.length > 20) {
                            updateData.description = desc;
                            updated = true;
                        }
                    }

                    // Authors Matching (Requires another lookup usually, but some editions have literals or we can extract from keys)
                    // For now, let's look for 'authors' in the blob if they are simple strings
                    if (match.needsAuthor && data.authors && data.authors.length > 0) {
                        // In OL, authors are often just keys, but sometimes names are present in 'author_name' on other records
                        // However, let's see if we can get anything useful.
                        // Actually, Open Library dump for editions doesn't typically have the name, just the key.
                        // We will skip author name repair from OL dump for now to keep it high-accuracy,
                        // unless we find 'by_statement' or similar.
                        if (data.by_statement) {
                            updateData.author = data.by_statement;
                            updated = true;
                        }
                    }

                    // Image Matching
                    if (match.needsImage) {
                        let finalImageUrl = null;
                        if (data.covers && data.covers.length > 0) {
                            // Direct Cover ID Pattern
                            const coverId = data.covers[0];
                            if (coverId > 0) {
                                finalImageUrl = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
                            }
                        }

                        if (!finalImageUrl && match.isbn) {
                            // Fallback to ISBN Pattern
                            finalImageUrl = `https://covers.openlibrary.org/b/isbn/${match.isbn}-L.jpg`;
                        }

                        if (finalImageUrl) {
                            updateData.imageUrl = finalImageUrl;
                            updated = true;
                        }
                    }

                    // Subjects (Categories) Enrichment
                    if (data.subjects && data.subjects.length > 0) {
                        // We store subjects in updateData to be processed by processBatchUpdates
                        updateData.subjects = data.subjects.slice(0, 10); // Limit to top 10 subjects
                        updated = true;
                    }

                    if (updated) {
                        batchUpdates.push({ id: match.id, ...updateData });
                    }
                }
            } catch (e) { /* ignore parse errors */ }

            if (batchUpdates.length >= 100) {
                fixedCount += await processBatchUpdates(batchUpdates);
                batchUpdates = [];

                // Update Progress every 20,000 scanned lines
                if (lineCount % 20000 === 0) {
                    job.summary = `Scanned ${lineCount.toLocaleString()} OL records. Found ${fixedCount.toLocaleString()} matches.`;
                    await job.save();
                }
            }
        }

        // Final Batch
        if (batchUpdates.length > 0) {
            fixedCount += await processBatchUpdates(batchUpdates);
        }

        job.status = 'completed';
        job.progress = 100;
        job.fixedCount = fixedCount;
        job.endTime = new Date();
        job.summary = `Ultimate Repair Complete! Scanned ${lineCount.toLocaleString()} OL records. Enriched ${fixedCount.toLocaleString()} books.`;
        await job.save();

    } catch (err) {
        console.error('[BookService] Ultimate Repair Failed:', err);
        job.status = 'failed';
        job.summary = `Failed: ${err.message}`;
        job.endTime = new Date();
        await job.save();
    } finally {
        activeJobs.delete(job.id);
    }
}

async function downloadOpenLibraryDump(url, dest, job) {
    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            attempt++;

            // 1. Check if we can resume
            let startPos = 0;
            if (fs.existsSync(dest)) {
                const stats = fs.statSync(dest);
                startPos = stats.size;
            }

            console.log(`[BookService] Attempt ${attempt}: Downloading ${url} (Resuming from ${startPos} bytes)...`);
            job.summary = `Download Attempt ${attempt}/${maxRetries} (Resume: ${(startPos / 1024 / 1024).toFixed(1)} MB)...`;
            await job.save();

            const headers = {};
            if (startPos > 0) {
                headers['Range'] = `bytes=${startPos}-`;
            }

            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream',
                headers,
                timeout: 60000,
                validateStatus: (status) => status >= 200 && status < 300 || status === 416 // Support 416 for "already finished"
            });

            if (response.status === 416) {
                console.log('[BookService] Download already complete (416).');
                return;
            }

            const isResume = response.status === 206;
            const contentLen = parseInt(response.headers['content-length'] || 0);
            const totalRemoteSize = isResume ? (startPos + contentLen) : contentLen;

            let downloadedLength = isResume ? startPos : 0;
            let lastUpdateProgress = -1;
            let lastUpdateBytes = downloadedLength;

            // Open stream (append if resuming)
            const writer = fs.createWriteStream(dest, { flags: isResume ? 'a' : 'w' });
            let isAborted = false;

            response.data.on('data', (chunk) => {
                if (!activeJobs.has(job.id)) {
                    if (!isAborted) {
                        console.log('[BookService] Download stopped by user.');
                        isAborted = true;
                        response.data.destroy();
                        writer.destroy();
                    }
                    return;
                }

                downloadedLength += chunk.length;
                if (totalRemoteSize > 0) {
                    const progress = Math.floor((downloadedLength / totalRemoteSize) * 100);
                    // Update UI if percentage changes OR every 100MB
                    if (progress !== lastUpdateProgress || (downloadedLength - lastUpdateBytes) > 100 * 1024 * 1024) {
                        lastUpdateProgress = progress;
                        lastUpdateBytes = downloadedLength;

                        job.progress = progress;
                        job.summary = `Downloading OL Dump: ${progress}% (${(downloadedLength / 1024 / 1024).toFixed(1)} MB / ${(totalRemoteSize / 1024 / 1024).toFixed(1)} MB)`;
                        job.save().catch(() => { });
                    }
                }
            });

            response.data.pipe(writer);

            return await new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log(`[BookService] Download complete: ${dest}`);
                    resolve();
                });
                writer.on('error', (err) => {
                    console.error(`[BookService] Write error: ${err.message}`);
                    reject(err);
                });
                response.data.on('error', (err) => {
                    console.error(`[BookService] Stream error: ${err.message}`);
                    reject(err);
                });
            });
        } catch (err) {
            const isRetryable = err.response && (err.response.status === 503 || err.response.status === 429);
            if (isRetryable && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 2000;
                console.warn(`[BookService] Download failed (${err.response.status}). Retrying in ${delay / 1000}s...`);
                job.summary = `Server busy (${err.response.status}). Retrying in ${delay / 1000}s (Attempt ${attempt}/${maxRetries})...`;
                await job.save();
                await new Promise(r => setTimeout(r, delay));
            } else {
                console.error(`[BookService] Download fatal error: ${err.message}`);
                throw err;
            }
        }
    }
}

async function processBatchUpdates(updates) {
    let count = 0;
    const subjectsToEnsure = new Set();

    // 1. Collect and clean all subjects across the batch for pre-creation
    for (const item of updates) {
        if (item.subjects) {
            const cleanedSubjects = [];
            item.subjects.forEach(s => {
                if (!s) return;
                // Open Library often packs multiple subjects into one semicolon-delimited string
                const parts = s.split(';').map(p => p.trim()).filter(Boolean);
                parts.forEach(p => {
                    const truncated = p.substring(0, 255);
                    subjectsToEnsure.add(truncated);
                    cleanedSubjects.push(truncated);
                });
            });
            item.subjects = cleanedSubjects; // Re-assign cleaned list for step 3
        }
    }

    // 2. Ensure all Categories exist and get their IDs
    const categoryMap = {};
    if (subjectsToEnsure.size > 0) {
        for (const name of subjectsToEnsure) {
            const [cat] = await Category.findOrCreate({ where: { name } });
            categoryMap[name] = cat.id;
        }
    }

    // 3. Apply updates in Transaction
    await sequelize.transaction(async (t) => {
        for (const item of updates) {
            const { id, subjects, ...bookData } = item;

            // Defensive Truncation for metadata
            if (bookData.title) bookData.title = bookData.title.substring(0, 255);
            if (bookData.author) bookData.author = bookData.author.substring(0, 255);
            if (bookData.imageUrl) bookData.imageUrl = bookData.imageUrl.substring(0, 255);
            if (bookData.description) bookData.description = bookData.description.substring(0, 4000);

            // Update Book fields (Title, Author, Desc etc)
            if (Object.keys(bookData).length > 0) {
                // Enforce visibility
                const hasDescription = bookData.description && bookData.description.trim() !== '' && bookData.description !== 'No description available.';
                const hasAuthor = bookData.author && bookData.author !== 'Unknown' && bookData.author.trim() !== '';

                if (hasDescription && hasAuthor) {
                    bookData.isVisible = true;
                } else {
                    bookData.isVisible = false;
                }

                await Book.update(bookData, { where: { id }, transaction: t });
            }

            // Update Many-to-Many Categories
            if (subjects && subjects.length > 0) {
                const categoryIds = subjects.map(s => categoryMap[s]).filter(Boolean);
                if (categoryIds.length > 0) {
                    // Optimized sync: Insert associations, ignore duplicates
                    const mappings = categoryIds.map(catId => ({
                        BookId: id,
                        CategoryId: catId
                    }));
                    await BookCategory.bulkCreate(mappings, {
                        transaction: t,
                        ignoreDuplicates: true
                    });
                }
            }
            count++;
        }
    });
    return count;
}

module.exports = {
    fetchGoogleBooks,
    fixBookData,
    importBooksFromCSV,
    importManualZip,
    stopJob,
    pauseJob,
    resumeJob,
    startUltimateRepair
};
