const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

async function run() {
    const sqliteSequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, 'database.sqlite'),
        logging: false
    });

    try {
        const [rows] = await sqliteSequelize.query('SELECT isbn, imageUrl FROM Books WHERE isbn = "9783753460925"');
        console.log('SQLITE_RECORD:', JSON.stringify(rows[0], null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await sqliteSequelize.close();
    }
}
run();
