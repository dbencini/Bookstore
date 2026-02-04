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
        const [rows] = await sqliteSequelize.query('SELECT isbn, imageUrl FROM Books WHERE imageUrl NOT LIKE "%default_cover.svg%" AND imageUrl NOT LIKE "%placehold%" LIMIT 10');
        console.log('SQLITE_NON_DEFAULT:', JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await sqliteSequelize.close();
    }
}
run();
