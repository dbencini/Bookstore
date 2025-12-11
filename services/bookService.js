const axios = require('axios');
const cron = require('node-cron');
const { Book } = require('../models');

// Configure Google Books API URL
const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes';

async function fetchGoogleBooks(query = 'subject:fiction') {
    try {
        console.log(`[BookService] Fetching books for query: ${query}...`);
        const response = await axios.get(GOOGLE_BOOKS_API_URL, {
            params: {
                q: query,
                maxResults: 10,
                key: process.env.GOOGLE_API_KEY // Optional if we have it, but works without for limited quota
            }
        });

        const items = response.data.items || [];
        console.log(`[BookService] Found ${items.length} books.`);

        let addedCount = 0;
        for (const item of items) {
            const info = item.volumeInfo;
            if (!info.title || !info.authors) continue;

            // Map to our model
            const bookData = {
                title: info.title,
                author: info.authors ? info.authors.join(', ') : 'Unknown',
                description: info.description || 'No description available.',
                price: 19.99, // Google API often doesn't give price freely, using default
                imageUrl: info.imageLinks ? (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail) : 'https://placehold.co/200x300',
                category: 'General' // Could derive from info.categories
            };

            // Check duplicate by title
            const existing = await Book.findOne({ where: { title: bookData.title } });
            if (!existing) {
                await Book.create(bookData);
                addedCount++;
            }
        }
        console.log(`[BookService] Added ${addedCount} new books.`);
        return { success: true, added: addedCount };
    } catch (error) {
        console.error('[BookService] Error fetching books:', error.message);
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
    startCronJob
};
