const mysql = require('mysql2/promise');
require('dotenv').config();

async function createDatabase() {
    console.log('--- Creating MySQL Database ---');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS
    });

    try {
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`);
        console.log(`Database "${process.env.DB_NAME}" ensures or created.`);
    } catch (err) {
        console.error('Error creating database:', err.message);
    } finally {
        await connection.end();
    }
}

createDatabase();
