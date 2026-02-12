require('dotenv').config();
const { sequelize } = require('../models');

async function run() {
    try {
        console.log('--- MONITORING TRANSACTIONS ---');
        const [processes] = await sequelize.query('SHOW FULL PROCESSLIST');
        let foundZombie = false;

        for (const p of processes) {
            // Looking for updates that have been running for more than 30 seconds
            // DO NOT kill our own connection or the swap connection
            if (p.Id !== myId && p.Info && (p.Info.toLowerCase().includes('update') || p.Info.toLowerCase().includes('isVisible'))) {
                // If it's our own table_swap.js, leave it alone!
                if (p.Info.includes('table_swap.js') || p.Info.includes('INSERT INTO Books_New')) {
                    console.log(`STAYING ALIVE: ID ${p.Id} (Table Swap)`);
                    continue;
                }

                console.log(`FOUND UPDATE: ID ${p.Id}, Time: ${p.Time}, State: ${p.State}, Info: ${p.Info}`);
                foundZombie = true;

                if (p.Time > 10) {
                    console.log(`Killing zombie ID: ${p.Id}`);
                    try {
                        await sequelize.query(`KILL ${p.Id}`);
                    } catch (e) {
                        console.log(`Kill failed (might be already dead or rolling back): ${e.message}`);
                    }
                }
            }
        }

        if (!foundZombie) {
            console.log('No active updates found. Checking for rollback in InnoDB status...');
            const [status] = await sequelize.query('SHOW ENGINE INNODB STATUS');
            const fullStatus = status[0].Status;

            // Look for "History list length" or transaction undo stats
            if (fullStatus.includes('TRANSACTIONS')) {
                const txSection = fullStatus.split('------------\nTRANSACTIONS')[1].split('------------')[0];
                console.log('--- TRANSACTION DETAILS ---');
                console.log(txSection);
            }
        }

        process.exit(0);
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

run();
