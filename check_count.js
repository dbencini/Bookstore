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

        const [processes] = await c.query("SHOW PROCESSLIST");
        console.log('PROCESS_LIST:', JSON.stringify(processes, null, 2));

        const [rows] = await c.query("SELECT COUNT(*) as count FROM Books");
        console.log('REAL_BOOKS_COUNT:' + rows[0].count);

        const [rows2] = await c.query("SELECT COUNT(*) as count FROM BookCategories");
        console.log('MAPPINGS_COUNT:' + rows2[0].count);

        await c.end();
    } catch (e) {
        console.log('ERROR:' + e.message);
    }
}
run();
