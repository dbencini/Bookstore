const sequelize = require('./config/database');
const { Book, Category } = require('./models');
const { Op } = require('sequelize');

async function profileAdmin() {
    console.log('--- Admin Performance Profiling (Optimized Version) ---');

    const where = {
        imageUrl: { [Op.ne]: null }
    };

    // 1. Timing COUNT (No Include)
    console.log('1. Timing COUNT (No Include)...');
    const startCount = Date.now();
    const count = await Book.count({ where });
    console.log(`   Count: ${count} in ${Date.now() - startCount}ms`);

    // 2. Timing findAll (Sorted, Limit 12)
    console.log('2. Timing findAll (Sorted by updatedAt DESC, limit 12, offset 0)...');
    const startFind = Date.now();
    const rows = await Book.findAll({
        where,
        limit: 12,
        offset: 0,
        order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']]
    });
    console.log(`   Rows: ${rows.length} in ${Date.now() - startFind}ms`);

    // 3. Timing findAll (No Sort)
    console.log('3. Timing findAll (NO SORT, limit 12, offset 0)...');
    const startFindNoSort = Date.now();
    const rowsNoSort = await Book.findAll({
        where,
        limit: 12,
        offset: 0
    });
    console.log(`   Rows: ${rowsNoSort.length} in ${Date.now() - startFindNoSort}ms`);

    await sequelize.close();
    process.exit(0);
}

profileAdmin().catch(err => {
    console.error(err);
    process.exit(1);
});
