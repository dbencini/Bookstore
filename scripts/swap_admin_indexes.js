require('dotenv').config();
const { sequelize } = require('../models');

async function swapIndexes() {
    try {
        console.log('Swapping indexes for better ORDER BY performance...');

        const drops = [
            'DROP INDEX idx_books_price_updated_at ON books',
            'DROP INDEX idx_books_author_prefix_updated_at ON books',
            'DROP INDEX idx_books_title_prefix_updated_at ON books',
            'DROP INDEX idx_books_image_prefix_updated_at ON books',
            'DROP INDEX idx_books_description_prefix_updated_at ON books'
        ];

        for (const sql of drops) {
            try {
                await sequelize.query(sql);
                console.log(`Dropped old index: ${sql}`);
            } catch (e) {
                console.log(`Failed to drop (maybe didn't exist): ${sql} - ${e.message}`);
            }
        }

        const adds = [
            { name: 'idx_books_updated_at_price', sql: 'CREATE INDEX idx_books_updated_at_price ON books (updatedAt, price)' },
            { name: 'idx_books_updated_at_author_prefix', sql: 'CREATE INDEX idx_books_updated_at_author_prefix ON books (updatedAt, author(50))' },
            { name: 'idx_books_updated_at_title_prefix', sql: 'CREATE INDEX idx_books_updated_at_title_prefix ON books (updatedAt, title(50))' },
            { name: 'idx_books_updated_at_image_prefix', sql: 'CREATE INDEX idx_books_updated_at_image_prefix ON books (updatedAt, imageUrl(50))' },
            { name: 'idx_books_updated_at_description_prefix', sql: 'CREATE INDEX idx_books_updated_at_description_prefix ON books (updatedAt, description(50))' }
        ];

        for (const idx of adds) {
            console.log(`Adding ${idx.name}...`);
            await sequelize.query(idx.sql);
            console.log(`✓ ${idx.name} added.`);
        }

        console.log('Index swap complete.');

    } catch (err) {
        console.error('Swap failed:', err);
    } finally {
        await sequelize.close();
    }
}

swapIndexes();
