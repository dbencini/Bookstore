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

        // Search the first 1M IDs for speed - many processed books should be in this range
        const [rows] = await c.query('SELECT isbn, title FROM Books WHERE id < 1000000 AND imageUrl LIKE "%covers.openlibrary.org%" LIMIT 5');

        const fs = require('fs');
        if (rows.length > 0) {
            fs.writeFileSync('isbn_samples.txt', JSON.stringify(rows, null, 2));
        } else {
            const [any] = await c.query('SELECT isbn, title FROM Books LIMIT 5');
            fs.writeFileSync('isbn_samples.txt', "No enriched found, here are any 5:\n" + JSON.stringify(any, null, 2));
        }

        await c.end();
    } catch (e) {
        require('fs').writeFileSync('isbn_samples.txt', 'Error: ' + e.message);
    }
}
run();
