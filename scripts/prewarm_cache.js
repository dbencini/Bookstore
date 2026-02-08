require('dotenv').config();
const { Category, Book, sequelize } = require('../models');

async function prewarm() {
    console.log('--- Pre-warming Category Cache ---');
    const categories = await Category.findAll();

    // We'll mimic the request to /books?category=...
    for (const cat of categories) {
        console.log(`Pre-warming: ${cat.name}...`);
        const startTime = Date.now();

        // This matched the logic in routes/index.js
        const limit = 8;
        const page = 1;
        const offset = 0;

        const [books] = await sequelize.query(`
            SELECT * FROM books USE INDEX (books_is_visible_created_at)
            WHERE isVisible = true 
            AND id IN (SELECT BookId FROM book_category WHERE CategoryId = '${cat.id}') 
            ORDER BY createdAt DESC 
            LIMIT 8 OFFSET 0
        `);

        const duration = Date.now() - startTime;
        console.log(`  Done (${duration}ms, found ${books.length} initial items)`);
    }

    console.log('Pre-warming complete.');
    process.exit(0);
}

prewarm();
