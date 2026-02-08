const sequelize = require('./config/database');
const { Book } = require('./models');
const { Op } = require('sequelize');

async function profile() {
    console.log('--- Performance Profiling ---');

    const where = {
        isVisible: true,
        imageUrl: {
            [Op.and]: [
                { [Op.ne]: null },
                { [Op.ne]: '' },
                { [Op.ne]: '/images/placeholder-book.png' },
                { [Op.ne]: 'https://placehold.co/200x300' }
            ]
        }
    };

    // 1. Profile Count
    console.log('1. Timing COUNT(*) with where clause...');
    const startCount = Date.now();
    const count = await Book.count({ where });
    console.log(`   Count: ${count} in ${Date.now() - startCount}ms`);

    // 2. Profile Data Fetch (Unindexed Sort)
    console.log('2. Timing DATA FETCH (Sorted by createdAt DESC, limit 12)...');
    const startData1 = Date.now();
    const data1 = await Book.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: 12
    });
    console.log(`   Rows: ${data1.length} in ${Date.now() - startData1}ms (Unindexed Sort)`);

    // 3. Profile Data Fetch (No Sort)
    console.log('3. Timing DATA FETCH (No Sort, limit 12)...');
    const startData2 = Date.now();
    const data2 = await Book.findAll({
        where,
        limit: 12
    });
    console.log(`   Rows: ${data2.length} in ${Date.now() - startData2}ms (No Sort)`);

    // 4. EXPLAIN everything
    console.log('\n--- EXPLAIN results ---');
    const [explain] = await sequelize.query(`
        EXPLAIN SELECT id, title FROM Books 
        WHERE isVisible = 1
        AND imageUrl IS NOT NULL 
        AND imageUrl != '' 
        AND imageUrl != '/images/placeholder-book.png'
        AND imageUrl != 'https://placehold.co/200x300'
        ORDER BY createdAt DESC
        LIMIT 12
    `);
    console.table(explain);

    await sequelize.close();
    process.exit(0);
}

profile();
