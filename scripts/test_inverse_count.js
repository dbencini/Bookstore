require('dotenv').config();
const { sequelize } = require('../models');

async function testInverseCount() {
    try {
        console.log('Testing Inverse Count Strategy...');
        const startTotal = Date.now();
        const [totalResult] = await sequelize.query('SELECT COUNT(*) as count FROM books');
        const total = totalResult[0].count;
        console.log(`Total Count: ${total} (${Date.now() - startTotal}ms)`);

        const startPresent = Date.now();
        const [presentResult] = await sequelize.query(`
            SELECT COUNT(*) as count FROM books 
            WHERE author IS NOT NULL AND author != '' AND author != 'Unknown'
        `);
        const present = presentResult[0].count;
        console.log(`Present Count: ${present} (${Date.now() - startPresent}ms)`);

        console.log(`Missing Count (Calculated): ${total - present}`);

    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        await sequelize.close();
    }
}

testInverseCount();
