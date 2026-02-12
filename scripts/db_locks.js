require('dotenv').config();
const { sequelize } = require('../models');

async function run() {
    try {
        console.log('--- Current MySQL Processes ---');
        const [results] = await sequelize.query('SHOW FULL PROCESSLIST');
        results.forEach(p => {
            if (p.Command !== 'Sleep') {
                console.log(`ID: ${p.Id}, User: ${p.User}, State: ${p.State}, Time: ${p.Time}, Info: ${p.Info}`);
            }
        });

        console.log('\n--- InnoDB Status (Locks) ---');
        const [status] = await sequelize.query('SHOW ENGINE INNODB STATUS');
        console.log(status[0].Status);

        process.exit(0);
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

run();
