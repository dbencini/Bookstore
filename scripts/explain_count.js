require('dotenv').config();
const { sequelize } = require('../models');

async function explainCount() {
    try {
        const query = `
            SELECT COUNT(*) FROM books 
            WHERE (author IS NULL OR author = '' OR author = 'Unknown')
        `;

        console.log('--- Explain Standard Count ---');
        const [results] = await sequelize.query(`explain ${query}`);
        console.log(JSON.stringify(results, null, 2));

        console.log('--- Explain Foreced Index Count ---');
        const queryForce = `
            SELECT COUNT(*) FROM books FORCE INDEX (idx_books_author_simple)
            WHERE (author IS NULL OR author = '' OR author = 'Unknown')
        `;
        const [resultsForce] = await sequelize.query(`explain ${queryForce}`);
        console.log(JSON.stringify(resultsForce, null, 2));

        // Let's also run the actual count with force index to see if it's faster
        console.log('--- Run Forced Index Count ---');
        const start = Date.now();
        const [countResult] = await sequelize.query(queryForce);
        console.log(`Count: ${countResult[0]['COUNT(*)']} | Time: ${Date.now() - start}ms`);

    } catch (err) {
        console.error('Explain failed:', err);
    } finally {
        await sequelize.close();
    }
}

explainCount();
