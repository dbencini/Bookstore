require('dotenv').config();
const { sequelize } = require('../models');

async function debug() {
    try {
        const [cat] = await sequelize.query("SELECT id, name FROM category WHERE name = 'Bestseller'");
        console.log('Category Found:', cat[0]);

        if (cat[0]) {
            const [links] = await sequelize.query(`SELECT * FROM book_category WHERE CategoryId = '${cat[0].id}'`);
            console.log(`Links in DB for this CategoryId: ${links.length}`);
            if (links.length > 0) {
                console.log('Sample Link:', links[0]);
                const [book] = await sequelize.query(`SELECT id, title, isVisible FROM books WHERE id = '${links[0].BookId}'`);
                console.log('Linked Book Status:', book[0]);
            }
        }
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

debug();
