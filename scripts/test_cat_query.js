require('dotenv').config();
const { Category } = require('../models');

async function testQuery() {
    try {
        console.log('Testing category list query...');
        const start = Date.now();
        const categories = await Category.findAll({
            order: [['priority', 'DESC'], ['name', 'ASC']],
            timeout: 5000
        });
        console.log(`Query completed in ${Date.now() - start}ms`);
        console.log(`Found ${categories.length} categories.`);
    } catch (err) {
        console.error('Query failed:', err);
    }
    process.exit(0);
}

testQuery();
