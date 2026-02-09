require('dotenv').config();
const { Category, sequelize } = require('./models');

async function fastRecovery() {
    try {
        await sequelize.authenticate();
        console.log('Connected.');

        const [results] = await Category.findOrCreate({ where: { name: 'New Books' } });
        const targetId = results.id;
        console.log(`Targeting "New Books": ${targetId}`);

        console.log('Starting High-Performance Link Recovery...');
        const startTime = Date.now();

        // Use a single powerful query to link everything missing
        // We use UUID() for ID generation. Note: MySQL UUID() is fine here.
        const [queryResult] = await sequelize.query(`
            INSERT IGNORE INTO book_category (id, BookId, CategoryId, createdAt, updatedAt)
            SELECT UUID(), b.id, :targetId, NOW(), NOW()
            FROM books b
            LEFT JOIN book_category bc ON b.id = bc.BookId
            WHERE bc.BookId IS NULL
        `, {
            replacements: { targetId }
        });

        const elapsed = (Date.now() - startTime) / 1000;
        console.log(`Recovery Query Finished in ${elapsed}s.`);

        console.log('Updating Category Counts...');
        const [countResult] = await sequelize.query(`
            UPDATE category 
            SET book_count = (SELECT COUNT(*) FROM book_category WHERE CategoryId = :targetId)
            WHERE id = :targetId
        `, {
            replacements: { targetId }
        });

        console.log('Site Restored.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fastRecovery();
