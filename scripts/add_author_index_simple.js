require('dotenv').config();
const { sequelize } = require('../models');

async function addAuthorIndex() {
    try {
        console.log('Adding simple author index for COUNT optimization...');
        await sequelize.query('CREATE INDEX idx_books_author_simple ON books (author(50))');
        console.log('✓ idx_books_author_simple added.');
    } catch (err) {
        console.error('Failed:', err);
    } finally {
        await sequelize.close();
    }
}

addAuthorIndex();
