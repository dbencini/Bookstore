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

        const [rows] = await c.query('SELECT imageUrl, count(*) as count FROM Books GROUP BY imageUrl ORDER BY count DESC LIMIT 10');
        console.log('COMMON_IMAGES:', JSON.stringify(rows, null, 2));

        await c.end();
    } catch (e) {
        console.error('Error:', e.message);
    }
}
run();
