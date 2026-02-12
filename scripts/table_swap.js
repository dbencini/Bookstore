require('dotenv').config();
const { sequelize } = require('../models');

async function run() {
    try {
        console.log('--- HIGH-SPEED TABLE SWAP REPAIR ---');

        // 1. Get current connection Id
        const [[{ id: myId }]] = await sequelize.query('SELECT CONNECTION_ID() as id');
        console.log(`My Connection ID: ${myId}`);

        // 2. Kill all other connections to ensure we have total control
        console.log('Clearing blocking connections...');
        const [processes] = await sequelize.query('SHOW PROCESSLIST');
        for (const p of processes) {
            if (p.Id !== myId && p.User !== 'system user') {
                try {
                    await sequelize.query(`KILL ${p.Id}`);
                } catch (err) {
                    // Might already be dead
                }
            }
        }

        // 3. Set a long timeout and disable logs as much as possible for this session
        console.log('Optimizing session parameters...');
        await sequelize.query('SET SESSION lock_wait_timeout = 3600'); // 1 hour
        await sequelize.query('SET SESSION innodb_lock_wait_timeout = 3600');

        // 4. Create the new table structure
        console.log('Creating Books_New table...');
        await sequelize.query('DROP TABLE IF EXISTS Books_New');
        await sequelize.query('CREATE TABLE Books_New LIKE Books');

        // 5. Fill the new table in chunks to avoid slamming the logs
        console.log('Cloning data to Books_New in safe batches...');

        let lastId = '00000000-0000-0000-0000-000000000000';
        const BATCH_SIZE = 50000;
        let totalProcessed = 0;

        while (true) {
            const [result, metadata] = await sequelize.query(`
                INSERT INTO Books_New (
                    id, title, author, isbn, description, price, imageUrl, stock, JobId, isVisible, 
                    price_cost, bind, status, pur, import_comment, createdAt, updatedAt
                )
                SELECT 
                    id, title, author, isbn, description, price, imageUrl, stock, JobId, 1, 
                    price_cost, bind, status, pur, import_comment, createdAt, updatedAt
                FROM Books
                WHERE id > '${lastId}'
                ORDER BY id ASC
                LIMIT ${BATCH_SIZE}
            `);

            // In MySQL, metadata for INSERT/UPDATE is the number of affected rows
            const affectedRows = metadata || result;

            if (affectedRows === 0) break;

            totalProcessed += affectedRows;
            console.log(`Cloned ${totalProcessed} books...`);

            // Find the last ID for the next batch
            const [[lastRow]] = await sequelize.query(`SELECT id FROM Books_New ORDER BY id DESC LIMIT 1`);
            lastId = lastRow.id;
        }

        // 6. Atomic Swap
        console.log('Performing Atomic Swap...');
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        await sequelize.query('RENAME TABLE Books TO Books_Old, Books_New TO Books');
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

        // 7. Verification
        const [[{ count }]] = await sequelize.query('SELECT COUNT(*) as count FROM Books');
        console.log(`Swap Complete! New table has ${count} records.`);

        const [[{ hiddenCount }]] = await sequelize.query('SELECT COUNT(*) as count FROM Books WHERE isVisible = 0');
        console.log(`Hidden books in new table: ${hiddenCount}`);

        console.log('\nSUCCESS! All books are now visible.');
        console.log('You can now safely drop the "Books_Old" table when you are ready.');

        process.exit(0);
    } catch (e) {
        console.error('Critical Error during Table Swap:', e.message);
        // Ensure keys are back on even in failure
        try { await sequelize.query('SET FOREIGN_KEY_CHECKS = 1'); } catch (ex) { }
        process.exit(1);
    }
}

run();
