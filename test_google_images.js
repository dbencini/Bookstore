require('dotenv').config();
const axios = require('axios');

async function testGoogleBooks(isbns) {
    const apiKey = process.env.GOOGLE_BOOK_API;
    for (const isbn of isbns) {
        console.log(`Checking ISBN: ${isbn}...`);
        try {
            const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${apiKey}`;
            const response = await axios.get(url);
            const items = response.data.items || [];
            if (items.length > 0) {
                const info = items[0].volumeInfo;
                console.log(`  Title: ${info.title}`);
                console.log(`  Has ImageLinks: ${!!info.imageLinks}`);
                if (info.imageLinks) {
                    console.log(`  Thumbnail: ${info.imageLinks.thumbnail || 'N/A'}`);
                }
            } else {
                console.log('  Not found in Google Books.');
            }
        } catch (err) {
            console.error(`  Error: ${err.message}`);
        }
        console.log('---');
    }
}

testGoogleBooks(['9780645525526', '9783755738671', '9780366596096']);
