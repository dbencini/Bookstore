require('dotenv').config();
const { sequelize } = require('../models');

async function addAdminIndexes() {
    try {
        console.log('Adding indexes for Admin Quick Filters...');

        const indexes = [
            {
                name: 'idx_books_price_updated_at',
                sql: 'CREATE INDEX idx_books_price_updated_at ON books (price, updatedAt)'
            },
            {
                name: 'idx_books_author_prefix_updated_at',
                sql: 'CREATE INDEX idx_books_author_prefix_updated_at ON books (author(50), updatedAt)'
            },
            {
                name: 'idx_books_title_prefix_updated_at',
                sql: 'CREATE INDEX idx_books_title_prefix_updated_at ON books (title(50), updatedAt)'
            },
            {
                name: 'idx_books_image_prefix_updated_at',
                sql: 'CREATE INDEX idx_books_image_prefix_updated_at ON books (imageUrl(50), updatedAt)'
            },
            {
                name: 'idx_books_description_prefix_updated_at',
                sql: 'CREATE INDEX idx_books_description_prefix_updated_at ON books (description(50), updatedAt)'
            }
        ];

        for (const idx of indexes) {
            console.log(`Adding ${idx.name}...`);
            try {
                await sequelize.query(idx.sql);
                console.log(`✓ ${idx.name} added.`);
            } catch (err) {
                if (err.original && err.original.code === 'ER_DUP_KEYNAME') {
                    console.log(`- ${idx.name} already exists.`);
                } else {
                    console.error(`x Failed to add ${idx.name}:`, err.message);
                }
            }
        }

        console.log('All indexes processed.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await sequelize.close();
    }
}

addAdminIndexes();
