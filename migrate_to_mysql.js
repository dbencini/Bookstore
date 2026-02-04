const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const modelsDef = require('./models');

async function migrate() {
    console.log('--- Starting Optimized SQLite to MySQL Migration ---');

    const sqliteSequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, 'database.sqlite'),
        logging: false
    });

    const mysqlSequelize = modelsDef.sequelize;

    try {
        await sqliteSequelize.authenticate();
        console.log('Connected to SQLite.');
        await mysqlSequelize.authenticate();
        console.log('Connected to MySQL.');

        // NOTE: We do NOT sync force: true here if we want to resume,
        // but since we want to ensure schema is correct, we'll sync standard.
        // If you want to start fresh, uncomment the next line:
        // await mysqlSequelize.sync({ force: true });
        await mysqlSequelize.sync();
        console.log('MySQL Schema Synced.');

        const modelsOrder = [
            { name: 'UserTypes', model: modelsDef.UserType },
            { name: 'Users', model: modelsDef.User },
            { name: 'Categories', model: modelsDef.Category },
            { name: 'Jobs', model: modelsDef.Job },
            { name: 'Books', model: modelsDef.Book },
            { name: 'BookCategories', model: modelsDef.BookCategories || modelsDef.BookCategory },
            { name: 'OrderSources', model: modelsDef.OrderSource },
            { name: 'Orders', model: modelsDef.Order },
            { name: 'OrderNotes', model: modelsDef.OrderNote },
            { name: 'OrderItems', model: modelsDef.OrderItem },
            { name: 'Workshops', model: modelsDef.Workshop },
            { name: 'SiteConfigs', model: modelsDef.SiteConfig },
            { name: 'FooterSettings', model: modelsDef.FooterSetting },
            { name: 'CartItems', model: modelsDef.CartItem },
            { name: 'CpOrders', model: modelsDef.CpOrder },
            { name: 'CpOrderItems', model: modelsDef.CpOrderItem },
            { name: 'CpAddresses', model: modelsDef.CpAddress },
            { name: 'CpFiles', model: modelsDef.CpFile },
            { name: 'CpSignals', model: modelsDef.CpSignal }
        ];

        for (const m of modelsOrder) {
            if (!m.model) continue;

            console.log(`\nMigrating ${m.name}...`);
            let count = 0;
            try {
                const total = await sqliteSequelize.query(`SELECT COUNT(*) as count FROM ${m.name}`, { type: Sequelize.QueryTypes.SELECT });
                count = total[0].count;
            } catch (e) {
                console.warn(`Table ${m.name} likely doesn't exist in source. Skipping.`);
                continue;
            }

            // Check how many we already have in MySQL to skip if possible
            const destCount = await m.model.count();
            if (destCount >= count && m.name !== 'Books' && m.name !== 'BookCategories') {
                console.log(`  ${m.name} appears already migrated (${destCount} in MySQL, ${count} in SQLite). Skipping.`);
                continue;
            }

            console.log(`Total records to migrate: ${count.toLocaleString()}`);

            const BATCH_SIZE = (m.name === 'Books' || m.name === 'BookCategories') ? 10000 : 1000;
            let lastRowId = 0;
            let migratedCount = destCount;

            while (true) {
                // Using rowid for SQLite is MUCH faster than OFFSET
                const records = await sqliteSequelize.query(`SELECT rowid, * FROM ${m.name} WHERE rowid > ${lastRowId} ORDER BY rowid ASC LIMIT ${BATCH_SIZE}`, {
                    type: Sequelize.QueryTypes.SELECT
                });

                if (records.length === 0) break;

                // Strip rowid before inserting into MySQL
                const cleanRecords = records.map(r => {
                    const { rowid, ...rest } = r;
                    return rest;
                });

                try {
                    await m.model.bulkCreate(cleanRecords, { ignoreDuplicates: true });
                } catch (batchErr) {
                    // Slow fallback for constraint failures
                    for (const rec of cleanRecords) {
                        try {
                            await m.model.create(rec);
                        } catch (sErr) { /* ignore duplicates */ }
                    }
                }

                lastRowId = records[records.length - 1].rowid;
                migratedCount += records.length;

                if (migratedCount % (BATCH_SIZE * 2) === 0 || migratedCount >= count) {
                    process.stdout.write(`  Progress (approx): ${migratedCount.toLocaleString()} / ${count.toLocaleString()} (${((migratedCount / count) * 100).toFixed(1)}%)\r`);
                }
            }
            console.log(`\n${m.name} Migration Complete.`);
        }

        console.log('\n--- Migration Finished Successfully ---');

    } catch (err) {
        console.error('Migration fatal error:', err);
    } finally {
        await sqliteSequelize.close();
        await mysqlSequelize.close();
    }
}

migrate();
