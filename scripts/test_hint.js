require('dotenv').config();
const { sequelize, Category } = require('../models');

async function benchmark() {
    try {
        const cat = await Category.findOne({ where: { name: 'Children & Young Adult' } });
        console.log(`Analyzing: ${cat.name}`);

        const hintSql = `
            SELECT * 
            FROM books USE INDEX (books_is_visible_created_at)
            WHERE isVisible = true 
            AND id IN (SELECT BookId FROM book_category WHERE CategoryId = '${cat.id}') 
            ORDER BY createdAt DESC 
            LIMIT 8 OFFSET 0;
        `;

        console.log('Running benchmark for INDEX-HINTED query...');
        const startTime = Date.now();
        const [rows] = await sequelize.query(hintSql);
        const duration = Date.now() - startTime;
        console.log(`Index-hinted query took ${duration}ms (returned ${rows.length} rows)`);

    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

benchmark();
