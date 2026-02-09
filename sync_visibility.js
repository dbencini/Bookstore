require('dotenv').config();
const { sequelize, Book } = require('./models');

async function syncVisibility() {
    console.log('--- Starting Visibility Sync ---');
    console.log('This will hide books with no description or placeholders.');

    try {
        // 1. Mark as invisible if missing description
        const [hideResult] = await sequelize.query(`
            UPDATE books 
            SET isVisible = false 
            WHERE description IS NULL 
            OR description = '' 
            OR description = 'No description available.'
            OR author IS NULL 
            OR author = '' 
            OR author = 'Unknown'
        `);
        console.log(`Updated records to invisible: ${hideResult.changedRows || 'Checked/Updated'}`);

        // 2. Clear caches if needed (optional here as it's a one-time)
        console.log('Sync complete.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await sequelize.close();
    }
}

syncVisibility();
