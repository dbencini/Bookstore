require('dotenv').config();
const { sequelize } = require('./models');

async function migrate() {
    console.log('--- Phase 1: Adding FULLTEXT Index (This may take a few minutes) ---');
    try {
        const [results] = await sequelize.query(`
            ALTER TABLE books 
            ADD FULLTEXT idx_title_author_fulltext(title, author)
        `);
        console.log('FULLTEXT index created successfully!');
    } catch (err) {
        if (err.message.includes('Duplicate key name')) {
            console.log('FULLTEXT index already exists.');
        } else {
            console.error('Migration failed:', err);
            process.exit(1);
        }
    } finally {
        await sequelize.close();
    }
}

migrate();
