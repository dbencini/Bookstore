require('dotenv').config();
const { sequelize } = require('../models');
const fs = require('fs');

async function run() {
    console.log('--- ROLLBACK PROGRESS TRACKER ---');
    console.log('Monitoring Process 239 rollback speed...');

    while (true) {
        try {
            const [tx] = await sequelize.query('SELECT blocking_trx_rows_modified FROM sys.innodb_lock_waits WHERE blocking_pid = 239');

            if (tx.length === 0) {
                console.log('Process 239 is no longer blocking! Rollback may be complete.');
                // Check if process list still has 239
                const [plist] = await sequelize.query('SHOW PROCESSLIST');
                const stillAlive = plist.some(p => p.Id === 239);
                if (!stillAlive) {
                    console.log('Process 239 is officially gone.');
                    break;
                }
            } else {
                const remaining = tx[0].blocking_trx_rows_modified;
                const timestamp = new Date().toLocaleTimeString();
                const logEntry = `${timestamp} - Remaining rows to rollback: ${remaining}\n`;
                console.log(logEntry.trim());
                fs.appendFileSync('rollback_stats.txt', logEntry);
            }
        } catch (e) {
            console.error('Monitoring Error:', e.message);
        }

        await new Promise(r => setTimeout(r, 60000)); // Check every minute
    }
}

run();
