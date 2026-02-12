require('dotenv').config();
const { sequelize } = require('../models');

async function run() {
    try {
        console.log('--- DATABASE PERFORMANCE OVERHAUL ---');

        // 1. Apply global tuning
        console.log('Setting innodb_flush_log_at_trx_commit = 0...');
        await sequelize.query('SET GLOBAL innodb_flush_log_at_trx_commit = 0');

        // 2. Verify
        const [result] = await sequelize.query("SHOW GLOBAL VARIABLES LIKE 'innodb_flush_log_at_trx_commit'");
        console.log(`Current Value: ${result[0].Value}`);

        if (result[0].Value === '0') {
            console.log('\nSUCCESS: Database is now in "TURBO" mode for bulk updates.');
        } else {
            console.log('\nWARNING: Setting did not stick. Check user permissions.');
        }

        process.exit(0);
    } catch (e) {
        console.error('Critical Error during tuning:', e.message);
        process.exit(1);
    }
}

run();
