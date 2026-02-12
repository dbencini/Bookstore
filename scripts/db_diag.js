require('dotenv').config();
const { sequelize } = require('../models');

async function checkDB() {
    try {
        console.log('Checking database process list...');
        const [results] = await sequelize.query('SHOW PROCESSLIST');
        console.table(results);

        console.log('\nChecking for locks...');
        const [locks] = await sequelize.query('SHOW ENGINE INNODB STATUS');
        console.log(locks[0].Status);

    } catch (err) {
        console.error('Failed to check DB:', err);
    }
    process.exit(0);
}

checkDB();
