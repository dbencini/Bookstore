require('dotenv').config();
const { sequelize, Book, Category } = require('../models');

async function benchmark() {
    try {
        // Find a sparse category (e.g. between 1000 and 5000 books) to trigger scan issues
        // We want a category that is NOT "New Books" and has enough books to be valid but few enough to be hard to find in a date scan if they are old.
        const [categories] = await sequelize.query(`
            SELECT id, name, book_count FROM category 
            WHERE book_count > 100
            ORDER BY book_count ASC LIMIT 1
        `);

        if (!categories || categories.length === 0) {
            console.error(JSON.stringify({ error: 'No categories > 100 books found' }));
            return;
        }

        const category = categories[0];
        const results = {
            category: { name: category.name, id: category.id, count: category.book_count },
            original: {},
            optimized: {}
        };

        const iterations = 3;

        // Test 1: Original
        const startOriginal = Date.now();
        await sequelize.query(`
            SELECT b.* FROM books b
            JOIN book_category bc ON b.id = bc.BookId
            WHERE bc.CategoryId = :categoryId AND b.isVisible = true 
            ORDER BY b.createdAt DESC LIMIT :limit OFFSET :offset
        `, {
            replacements: { categoryId: category.id, limit: 8, offset: 0 },
            type: sequelize.QueryTypes.SELECT,
            model: Book,
            mapToModel: true
        });
        results.original.averageMs = Date.now() - startOriginal; // Just one run for safety if it's slow

        // Test 2: Optimized
        const startOptimized = Date.now();
        await sequelize.query(`
            SELECT b.* FROM books b
            JOIN book_category bc ON b.id = bc.BookId
            WHERE bc.CategoryId = :categoryId AND b.isVisible = true 
            ORDER BY bc.createdAt DESC LIMIT :limit OFFSET :offset
        `, {
            replacements: { categoryId: category.id, limit: 8, offset: 0 },
            type: sequelize.QueryTypes.SELECT,
            model: Book,
            mapToModel: true
        });
        results.optimized.averageMs = Date.now() - startOptimized;

        const fs = require('fs');
        const path = require('path');
        fs.writeFileSync(path.join(__dirname, 'benchmark_result.json'), JSON.stringify(results, null, 2));

        console.log('BENCHMARK_RESULTS:' + JSON.stringify(results));

    } catch (error) {
        console.error(JSON.stringify({ error: error.message }));
    } finally {
        await sequelize.close();
    }
}

benchmark();
