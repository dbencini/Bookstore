require('dotenv').config();
const { sequelize } = require('../models');

async function addIndex() {
    try {
        console.log('Adding index idx_book_category_composite (CategoryId, BookId)...');
        await sequelize.query(`
            CREATE INDEX idx_book_category_composite 
            ON book_category (CategoryId, BookId);
        `);
        console.log('Index added successfully.');
    } catch (error) {
        if (error.original && error.original.code === 'ER_DUP_KEYNAME') {
            console.log('Index already exists, skipping.');
        } else {
            console.error('Failed to add index:', error);
        }
    } finally {
        await sequelize.close();
    }
}

addIndex();
