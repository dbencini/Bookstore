require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
    try {
        const c = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME
        });

        const samples = [
            '9783753460925',
            '9781447510819',
            '9780002007634',
            '9780000000001',
            '9780000110008'
        ];

        console.log('Force updating 5 books with Open Library thumbnails...');

        for (const isbn of samples) {
            const thumbUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
            await c.query('UPDATE Books SET imageUrl = ? WHERE isbn = ?', [thumbUrl, isbn]);
            console.log(`Updated ISBN: ${isbn} -> ${thumbUrl}`);
        }

        await c.end();
        console.log('Done. Please refresh the page in the browser.');
    } catch (e) {
        console.error('Error:', e.message);
    }
}
run();
