const { sequelize } = require('../models');

async function runMigration() {
    try {
        console.log('\n=================================================');
        console.log('--- MASTER JSON SUBJECT SYNC ENGINE ---');
        console.log('=================================================\n');

        // 1. Double check column exists
        console.log('[Step 1] Ensuring subjectIdsJson column exists...');
        try {
            await sequelize.query('ALTER TABLE Books ADD COLUMN subjectIdsJson JSON');
            console.log('  -> Column added.');
        } catch (e) {
            console.log('  -> Column already exists.');
        }

        const startTime = Date.now();
        let totalUpdated = 0;
        const BATCH_SIZE = 10000;

        // 2. Main Loop - Keep running as long as there are books to sync
        while (true) {
            console.log(`\n[Step 2] Fetching next batch of ${BATCH_SIZE.toLocaleString()} books...`);

            // This query efficiently finds books that haven't been synced yet
            // and grabs their associated subject IDs in one go
            const [rows] = await sequelize.query(`
                SELECT 
                    b.id,
                    GROUP_CONCAT(bs.SubjectId) as subjectIds
                FROM Books b
                JOIN book_subjects bs ON b.id = bs.BookId
                WHERE b.subjectIdsJson IS NULL OR b.subjectIdsJson = '[]'
                GROUP BY b.id
                LIMIT ${BATCH_SIZE}
            `);

            if (rows.length === 0) {
                console.log('\n[Finished] All books have been successfully synced!');
                break;
            }

            console.log(`[Step 3] Updating batch...`);

            // Update books in this batch
            await sequelize.transaction(async (t) => {
                for (const row of rows) {
                    const idsArray = row.subjectIds.split(',');
                    await sequelize.query(
                        'UPDATE Books SET subjectIdsJson = :ids WHERE id = :id',
                        {
                            replacements: { ids: JSON.stringify(idsArray), id: row.id },
                            transaction: t
                        }
                    );
                }
            });

            totalUpdated += rows.length;
            const elapsed = (Date.now() - startTime) / 1000;
            const perSec = (totalUpdated / elapsed).toFixed(1);

            console.log(`-----------------------------------------------`);
            console.log(`  Total Processed: ${totalUpdated.toLocaleString()}`);
            console.log(`  Average Rate:    ${perSec} records/sec`);
            console.log(`  Elapsed Time:    ${(elapsed / 60).toFixed(1)} minutes`);
            console.log(`-----------------------------------------------`);
        }

        process.exit(0);
    } catch (err) {
        console.error('\n[FATAL ERROR] Sync crashed:', err);
        process.exit(1);
    }
}

runMigration();
