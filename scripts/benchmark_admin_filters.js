require('dotenv').config();
const { sequelize, Book, Op } = require('../models');

async function benchmarkFilters() {
    try {
        console.log('Benchmarking Admin Quick Filters...');

        const filters = {
            'Missing Author': { author: { [Op.or]: [null, '', 'Unknown'] } },
            'Missing Image': { imageUrl: { [Op.or]: [null, ''] } },
            'Missing Title': { title: { [Op.or]: [null, ''] } },
            'Missing Description': { description: { [Op.or]: [null, '', 'No description available.'] } },
            'Missing Price': { price: { [Op.or]: [null, 0] } },
            'Incomplete (Hidden)': { isVisible: false }
        };

        const comparisons = [];

        for (const [name, where] of Object.entries(filters)) {
            const startCount = Date.now();
            const count = await Book.count({ where });
            const durationCount = Date.now() - startCount;

            const startFind = Date.now();
            const rows = await Book.findAll({
                where,
                limit: 12,
                offset: 0,
                order: [['updatedAt', 'DESC']],
                attributes: ['id']
            });
            const durationFind = Date.now() - startFind;
            const durationTotal = durationCount + durationFind;

            console.log(`[${name}] Count: ${count} (${durationCount}ms) | Find: ${rows.length} (${durationFind}ms) | Total: ${durationTotal}ms`);
            comparisons.push({ name, duration: durationTotal, count });

            // Run EXPLAIN for the findAll query
            try {
                const [explain] = await sequelize.query(`
                    EXPLAIN SELECT id FROM books 
                    WHERE ${getWhereSql(name)}
                    ORDER BY updatedAt DESC LIMIT 12
                `);
                // console.log(`EXPLAIN [${name}]:`, JSON.stringify(explain[0], null, 0)); 
            } catch (e) {
                // Ignore explain errors for now due to complexity of reconstructing SQL manually
            }
        }

    } catch (err) {
        console.error('Benchmark failed:', err);
    } finally {
        await sequelize.close();
    }
}

function getWhereSql(name) {
    // Approximate SQL for EXPLAIN (Sequelize generates complex SQL)
    switch (name) {
        case 'Missing Author': return "(author IS NULL OR author = '' OR author = 'Unknown')";
        case 'Missing Image': return "(imageUrl IS NULL OR imageUrl = '' OR imageUrl LIKE '%placehold.co%' OR imageUrl LIKE '%default_cover.svg%' OR imageUrl LIKE '%placeholder-book.png%')";
        case 'Missing Title': return "(title IS NULL OR title = '')";
        case 'Missing Description': return "(description IS NULL OR description = '' OR description = 'No description available.')";
        case 'Missing Price': return "(price IS NULL OR price = 0)";
        case 'Incomplete (Hidden)': return "isVisible = 0";
    }
}

benchmarkFilters();
