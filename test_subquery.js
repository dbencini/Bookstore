const sequelize = require('./config/database');
const { QueryTypes } = require('sequelize');

async function testSubquery() {
    console.log('--- Subquery Performance Test ---');

    // 1. Original Slow Query
    console.log('1. Timing Original Query (Order + Where + Limit)...');
    const start1 = Date.now();
    await sequelize.query(`
        SELECT id FROM Books 
        WHERE imageUrl IS NOT NULL 
        ORDER BY updatedAt DESC 
        LIMIT 12
    `);
    console.log(`   Result in ${Date.now() - start1}ms`);

    // 4. Double Sort (Original Sequelize Logic)
    console.log('4. Timing Double Sort (updatedAt DESC, createdAt DESC)...');
    const start4 = Date.now();
    await sequelize.query(`
        SELECT id FROM Books 
        WHERE imageUrl IS NOT NULL 
        ORDER BY updatedAt DESC, createdAt DESC 
        LIMIT 12
    `);
    console.log(`   Result in ${Date.now() - start4}ms`);

    // 3. Simple Sort (No Where)
    console.log('3. Timing Simple Sort (No Where)...');
    const start3 = Date.now();
    await sequelize.query(`
        SELECT id FROM Books ORDER BY updatedAt DESC LIMIT 12
    `);
    console.log(`   Result in ${Date.now() - start3}ms`);

    await sequelize.close();
    process.exit(0);
}

testSubquery();
