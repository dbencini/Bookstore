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

        const [rows] = await c.query('SELECT isbn, title, imageUrl FROM Books WHERE imageUrl LIKE "%covers.openlibrary.org%" LIMIT 5');

        const fs = require('fs');
        fs.writeFileSync('real_thumbnails.txt', JSON.stringify(rows, null, 2));

        await c.end();
    } catch (e) {
        require('fs').writeFileSync('real_thumbnails.txt', 'Error: ' + e.message);
    }
}
run();
