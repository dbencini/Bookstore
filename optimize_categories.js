require('dotenv').config();
const { sequelize } = require('./models');

async function optimize() {
    console.log('--- Phase 1: Cleaning up Visibility (Efficiently) ---');
    try {
        // Only update books where visibility needs to change
        const [r1] = await sequelize.query(`
            UPDATE books 
            SET isVisible = false 
            WHERE isVisible = true 
            AND (
                description IS NULL 
                OR description = '' 
                OR description = 'No description available.'
                OR author IS NULL 
                OR author = '' 
                OR author = 'Unknown'
            )
        `);
        console.log(`Hidden ${r1.changedRows || 0} low-quality books.`);

        console.log('\n--- Phase 2: Denormalizing Dates for Category Speed ---');
        // This syncs the link date with the book creation date so our index can sort instantly
        await sequelize.query(`
            UPDATE book_category bc
            INNER JOIN books b ON bc.BookId = b.id
            SET bc.createdAt = b.createdAt
        `);
        console.log('Category dates synchronized.');

        console.log('\n--- Phase 3: Creating High-Performance Index ---');
        // This is the "Magic Index" for sub-second categories
        await sequelize.query(`
            CREATE INDEX idx_category_created_at_desc 
            ON book_category (CategoryId, createdAt DESC)
        `);
        console.log('Performance index created.');

        console.log('\nOptimization Complete! Category browsing will now be instant.');

    } catch (err) {
        console.error('Optimization failed:', err);
    } finally {
        await sequelize.close();
    }
}

optimize();
