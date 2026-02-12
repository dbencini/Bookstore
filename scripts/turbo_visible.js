require('dotenv').config();
const { sequelize } = require('../models');

async function run() {
    try {
        console.log('--- TURBO VISIBILITY RESTORE ---');
        console.log('Using high-performance targeted ID updates for massive UUID table...');

        let total = 0;
        const BATCH_SIZE = 5000;

        while (true) {
            // 1. Fetch exactly 5000 IDs that need visibility
            const [rows] = await sequelize.query(
                `SELECT id FROM Books WHERE isVisible = 0 LIMIT ${BATCH_SIZE}`
            );

            if (rows.length === 0) break;

            // 2. Prepare the IDs for an IN clause
            const ids = rows.map(r => `'${r.id}'`).join(',');

            // 3. Update those specific IDs (very fast because it hits the Primary Key)
            const [result] = await sequelize.query(
                `UPDATE Books SET isVisible = 1 WHERE id IN (${ids})`
            );

            total += result.affectedRows;
            console.log(`Patching... Total Made Visible: ${total}`);

            // Allow a tiny breather for the DB
            await new Promise(r => setTimeout(r, 50));
        }

        console.log(`\nSUCCESS! All ${total} books are now visible.`);
        process.exit(0);
    } catch (e) {
        console.error('Turbo Patch Error:', e.message);
        process.exit(1);
    }
}

run();
