require('dotenv').config();
const { sequelize } = require('../models');

async function run() {
    try {
        console.log('--- REVERSE ORDER VISIBILITY UPDATE ---');
        console.log('Targeting rows from end to start to bypass rollback locks...');

        let total = 0;
        const BATCH_SIZE = 5000;

        while (true) {
            // Update the LAST 5000 hidden books first
            const [result] = await sequelize.query(
                `UPDATE Books SET isVisible = 1 WHERE isVisible = 0 ORDER BY id DESC LIMIT ${BATCH_SIZE}`
            );

            if (result.affectedRows === 0) break;

            total += result.affectedRows;
            console.log(`Updated ${total} books (Reverse order)...`);

            // Short sleep to allow others to connect
            await new Promise(r => setTimeout(r, 100));
        }

        console.log(`DONE! Successfully made ${total} books visible via reverse-order patching.`);
        process.exit(0);
    } catch (e) {
        console.error('Reverse Update Error:', e.message);
        process.exit(1);
    }
}

run();
