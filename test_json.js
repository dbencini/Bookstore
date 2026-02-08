const { sequelize } = require('./models');
async function test() {
    try {
        const [results] = await sequelize.query('SELECT JSON_OVERLAPS(\'["1", "2"]\', \'["2", "3"]\') as overlaps');
        console.log('JSON_OVERLAPS result:', results[0].overlaps);
        process.exit(0);
    } catch (e) {
        console.error('Error testing JSON_OVERLAPS:', e.message);
        process.exit(1);
    }
}
test();
