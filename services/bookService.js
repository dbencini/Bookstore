const axios = require('axios');
const cron = require('node-cron');
const { Book, Job, Category } = require('../models');
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
                key: process.env.GOOGLE_API_KEY
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

            const bookData = {
                title: info.title,
                author: info.authors ? info.authors.join(', ') : 'Unknown',
                description: info.description,
                price: 19.99,
                imageUrl: info.imageLinks.thumbnail || info.imageLinks.smallThumbnail,
                category: 'General',
                JobId: job.id
            };

            // Dynamic Category Handling
            if (info.categories && info.categories.length > 0) {
                const categoryName = info.categories[0];
                const [categoryObj, created] = await Category.findOrCreate({
                    where: { name: categoryName }
                });
                bookData.categoryId = categoryObj.id;
                bookData.category = categoryName; // Keep legacy string field in sync
            } else {
                // Default to 'New Books' or 'General' if no category found? 
                // Let's try to get 'New Books' if it exists from seed, otherwise General
                const defaultCat = await Category.findOne({ where: { name: 'New Books' } });
                if (defaultCat) {
                    bookData.categoryId = defaultCat.id;
                    bookData.category = 'New Books';
                }
            }

            const existing = await Book.findOne({ where: { title: bookData.title } });
            if (!existing) {
                await Book.create(bookData);
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
    let job;
    try {
        console.log('[BookService] Starting Data Fix Job...');
        job = await Job.create({
            type: 'data_fix',
            summary: 'Attempting to repair incomplete book records',
            startTime: new Date(),
            status: 'running'
        });

        activeJobs.add(job.id);

        // Find books with missing description OR placeholder image
        const badBooks = await Book.findAll({
            where: {
                [Op.or]: [
                    { description: null },
                    { description: '' },
                    { description: 'No description available.' },
                    { imageUrl: { [Op.like]: '%placehold.co%' } }
                ]
            }
        });

        console.log(`[BookService] Found ${badBooks.length} books to fix.`);
        let fixedCount = 0;
        let removedCount = 0;

        for (const book of badBooks) {
            // Check Cancellation
            if (!activeJobs.has(job.id)) {
                console.log(`[BookService] Fix Job ${job.id} cancelled by user.`);
                job.status = 'stopped';
                break;
            }

            try {
                // Rate limit (sleep 500ms)
                await new Promise(resolve => setTimeout(resolve, 500));

                const query = `intitle:${book.title}+inauthor:${book.author}`;
                const response = await axios.get(GOOGLE_BOOKS_API_URL, {
                    params: {
                        q: query,
                        maxResults: 1,
                        key: process.env.GOOGLE_API_KEY
                    }
                });

                const items = response.data.items || [];
                if (items.length > 0) {
                    const info = items[0].volumeInfo;
                    let updated = false;

                    // Fix Description
                    if ((!book.description || book.description === 'No description available.') && info.description) {
                        book.description = info.description;
                        updated = true;
                    }

                    // Fix Image
                    if (book.imageUrl.includes('placehold.co') && info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail)) {
                        book.imageUrl = info.imageLinks.thumbnail || info.imageLinks.smallThumbnail;
                        updated = true;
                    }

                    if (updated) {
                        book.JobId = job.id; // Associate with this repair job so it shows in UI
                        await book.save();
                        fixedCount++;
                    } else {
                        // API results found but no better data? Maybe delete if it's still "bad"
                        // But wait, if update was false, it means we didn't find *better* info, 
                        // but maybe we should check if the search result was valid enough to justify keeping it?
                        // For now, let's treat "items found but no match" as unfixable if the book is still broken.
                        // Actually, if we are in this block, we found items. 
                        // If we didn't update, it effectively means we couldn't fix it.
                        // So let's delete it.
                        console.log(`[BookService] No better data found for "${book.title}". Deleting...`);
                        await book.destroy();
                        removedCount++;
                    }
                } else {
                    // No items found - DELETE the unfixable book
                    console.log(`[BookService] No API results for "${book.title}". Deleting...`);
                    await book.destroy();
                    removedCount++;
                }
            } catch (innerErr) {
                console.warn(`[BookService] Failed to fix book ${book.id}: ${innerErr.message}`);
            }
        }

        if (activeJobs.has(job.id)) {
            job.status = 'completed';
            activeJobs.delete(job.id);
        }

        job.booksAdded = fixedCount;
        job.endTime = new Date();
        job.summary = `Fixed ${fixedCount}, Removed ${removedCount} out of ${badBooks.length} identified issues.`;
        await job.save();

        console.log(`[BookService] Fix Job Complete. Fixed ${fixedCount}, Removed ${removedCount}.`);
        return { success: true, fixed: fixedCount, removed: removedCount };

    } catch (error) {
        console.error('[BookService] Error fixing books:', error.message);
        if (job) {
            job.status = 'failed';
            job.summary += ` | Error: ${error.message}`;
            job.endTime = new Date();
            await job.save();
        }
        return { success: false, error: error.message };
    }
}

// Global variable to hold difference cron tasks if needed
let fetchTask;

function startCronJob() {
    // Run every day at midnight: '0 0 * * *'
    // Or closer to user request "twice a day": '0 0,12 * * *'
    fetchTask = cron.schedule('0 0,12 * * *', async () => {
        console.log('[BookService] Running scheduled job...');
        await fetchGoogleBooks('subject:fiction'); // Default query
        await fetchGoogleBooks('subject:science'); // Another query
    });
    console.log('[BookService] Cron job scheduled (Twice Daily).');
}

module.exports = {
    fetchGoogleBooks,
    fixBookData,
    cancelJob,
    startCronJob
};
