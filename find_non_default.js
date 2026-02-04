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

        // Search for anything NOT the default cover and NOT a placeholder
        const [rows] = await c.query('SELECT isbn, title, imageUrl FROM Books WHERE imageUrl NOT LIKE "%default_cover.svg%" AND imageUrl NOT LIKE "%placehold%" LIMIT 10');

        const fs = require('fs');
        fs.writeFileSync('non_default_images.txt', JSON.stringify(rows, null, 2));

        await c.end();
    } catch (e) {
        require('fs').writeFileSync('non_default_images.txt', 'Error: ' + e.message);
    }
}
run();
