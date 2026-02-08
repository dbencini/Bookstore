require('dotenv').config();
const { sequelize, Category } = require('../models');

async function debug() {
    try {
        const cat = await Category.findOne({ where: { name: 'Children & Young Adult' } });
        if (!cat) {
            console.log('Category not found');
            process.exit(0);
        }

        console.log(`Analyzing query for category: ${cat.name} (${cat.id})`);

        const sql = `
            SELECT count(*) AS count 
            FROM books AS Book 
            INNER JOIN book_category AS BookCategories ON Book.id = BookCategories.BookId 
            AND BookCategories.CategoryId = '${cat.id}' 
            WHERE Book.isVisible = true;
        `;

        const [results] = await sequelize.query('EXPLAIN FORMAT=JSON ' + sql);
        console.log('EXPLAIN JSON Result:');
        console.log(JSON.stringify(results, null, 2));

        // Also try EXPLAIN ANALYZE if MySQL 8.0.18+
        try {
            console.log('Running EXPLAIN ANALYZE...');
            const [analyze] = await sequelize.query('EXPLAIN ANALYZE ' + sql);
            console.log('EXPLAIN ANALYZE Result:');
            console.log(analyze[0]['EXPLAIN']);
        } catch (e) {
            console.log('EXPLAIN ANALYZE not supported or failed.');
        }

        const subquerySql = `
            SELECT * 
            FROM books 
            WHERE isVisible = true 
            AND id IN (SELECT BookId FROM book_category WHERE CategoryId = '${cat.id}') 
            ORDER BY createdAt DESC 
            LIMIT 8 OFFSET 0;
        `;

        console.log('Running benchmark for SUBQUERY-BASED query...');
        const startTime3 = Date.now();
        const [rows3] = await sequelize.query(subquerySql);
        const duration3 = Date.now() - startTime3;
        console.log(`Subquery query took ${duration3}ms (returned ${rows3.length} rows)`);

        const hintSql = `
            SELECT * 
            FROM books USE INDEX (books_is_visible_created_at)
            WHERE isVisible = true 
            AND id IN (SELECT BookId FROM book_category WHERE CategoryId = '${cat.id}') 
            ORDER BY createdAt DESC 
            LIMIT 8 OFFSET 0;
        `;

        console.log('Running benchmark for INDEX-HINTED query...');
        const startTime4 = Date.now();
        const [rows4] = await sequelize.query(hintSql);
        const duration4 = Date.now() - startTime4;
        console.log(`Index-hinted query took ${duration4}ms (returned ${rows4.length} rows)`);

        const [results4] = await sequelize.query('EXPLAIN FORMAT=JSON ' + hintSql);
        console.log('Index-hinted EXPLAIN JSON Result:');
        console.log(JSON.stringify(results4, null, 2));

    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

debug();
