require('dotenv').config();
const { sequelize, Book } = require('../models');

async function run() {
    try {
        console.log('--- EMERGENCY DATABASE MAINTENANCE ---');

        // 1. Get current connection Id to avoid killing self
        const [[{ id: myId }]] = await sequelize.query('SELECT CONNECTION_ID() as id');
        console.log(`My Connection ID: ${myId}`);

        // 2. Kill all other connections
        const [processes] = await sequelize.query('SHOW PROCESSLIST');
        for (const p of processes) {
            if (p.Id !== myId && p.User !== 'system user') {
                console.log(`Killing process ${p.Id} (${p.Info || 'Sleep'})`);
                try {
                    await sequelize.query(`KILL ${p.Id}`);
                } catch (err) {
                    console.log(`Could not kill ${p.Id}: ${err.message}`);
                }
            }
        }

        console.log('All other connections terminated. Starting visibility update...');

        // 3. Batch Update with IDs to be super safe
        const BATCH_SIZE = 5000;
        let total = 0;

        while (true) {
            // Use raw query for maximum speed and control
            const [result] = await sequelize.query(
                `UPDATE Books SET isVisible = 1 WHERE isVisible = 0 LIMIT ${BATCH_SIZE}`
            );

            if (result.affectedRows === 0) break;

            total += result.affectedRows;
            console.log(`Updated ${total} books...`);
        }

        console.log(`DONE! Successfully made ${total} books visible.`);
        process.exit(0);
    } catch (e) {
        console.error('Emergency Script Error:', e.message);
        process.exit(1);
    }
}

run();
