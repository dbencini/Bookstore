require('dotenv').config();
const { sequelize } = require('../models');

async function explainQuery() {
    try {
        const query = `
            SELECT id FROM books 
            WHERE (author IS NULL OR author = '' OR author = 'Unknown') 
            ORDER BY updatedAt DESC 
            LIMIT 12
        `;

        const [results] = await sequelize.query(`explain ${query}`);
        console.log('EXPLAIN Output:', JSON.stringify(results, null, 2));

        // Also try forcing the new index
        const queryForce = `
            SELECT id FROM books FORCE INDEX (idx_books_updated_at_author_prefix)
            WHERE (author IS NULL OR author = '' OR author = 'Unknown') 
            ORDER BY updatedAt DESC 
            LIMIT 12
        `;
        const [resultsForce] = await sequelize.query(`explain ${queryForce}`);
        console.log('EXPLAIN FORCE INDEX Output:', JSON.stringify(resultsForce, null, 2));

    } catch (err) {
        console.error('Explain failed:', err);
    } finally {
        await sequelize.close();
    }
}

explainQuery();
