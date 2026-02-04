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

        const [rows] = await c.query('SELECT isbn, title, imageUrl FROM Books LIMIT 5');

        if (rows.length > 0) {
            console.log("SUCCESS_FOUND_SAMPLES");
            rows.forEach(r => console.log(`ISBN: ${r.isbn} | Title: ${r.title}`));
        } else {
            console.log("NO_ENRICHED_THUMBNAILS_YET");
            const [any] = await c.query('SELECT isbn, title FROM Books LIMIT 5');
            console.log("Any 5 ISBNs:");
            any.forEach(r => console.log(`ISBN: ${r.isbn} | Title: ${r.title}`));
        }

        await c.end();
    } catch (e) {
        console.error('Error:', e.message);
    }
}
run();
