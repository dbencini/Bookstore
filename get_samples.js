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

        const [rows] = await c.query('SELECT isbn, title, imageUrl FROM Books WHERE isbn LIKE "978%" LIMIT 5');

        if (rows.length === 0) {
            console.log("No enriched thumbnails found yet. Checking for any books...");
            const [any] = await c.query('SELECT isbn, title, imageUrl FROM Books LIMIT 5');
            console.log("Samples:", JSON.stringify(any, null, 2));
        } else {
            console.log("Found enriched samples:");
            console.log(JSON.stringify(rows, null, 2));
        }

        await c.end();
    } catch (e) {
        console.error('Error:', e.message);
    }
}
run();
