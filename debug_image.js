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

        const [rows] = await c.query('SELECT isbn, title, imageUrl FROM Books WHERE isbn = ?', ['9783753460925']);
        console.log('RECORD_RESULT:', JSON.stringify(rows[0], null, 2));

        await c.end();
    } catch (e) {
        console.error('Error:', e.message);
    }
}
run();
