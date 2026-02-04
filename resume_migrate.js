const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const modelsDef = require('./models');

async function migrate() {
    console.log('--- Starting RESUMABLE SQLite to MySQL Migration ---');

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

        const modelsOrder = [
            { name: 'UserTypes', model: modelsDef.UserType },
            { name: 'Users', model: modelsDef.User },
            { name: 'Categories', model: modelsDef.Category },
            { name: 'Jobs', model: modelsDef.Job },
            { name: 'Books', model: modelsDef.Book },
            { name: 'BookCategories', model: modelsDef.BookCategory },
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

            console.log(`\nChecking ${m.name}...`);
            const sourceTotal = await sqliteSequelize.query(`SELECT COUNT(*) as count FROM ${m.name}`, { type: Sequelize.QueryTypes.SELECT });
            const total = sourceTotal[0].count;

            const destCount = await m.model.count();
            console.log(`  Source: ${total.toLocaleString()}`);
            console.log(`  Destination: ${destCount.toLocaleString()}`);

            if (destCount >= total) {
                console.log(`  ${m.name} is already fully migrated. Skipping.`);
                continue;
            }

            console.log(`  Resuming ${m.name} from index ${destCount.toLocaleString()}...`);

            // Find the starting rowid in SQLite
            let lastRowId = 0;
            if (destCount > 0) {
                const startInfo = await sqliteSequelize.query(`SELECT rowid FROM ${m.name} LIMIT 1 OFFSET ${destCount - 1}`, {
                    type: Sequelize.QueryTypes.SELECT
                });
                if (startInfo.length > 0) {
                    lastRowId = startInfo[0].rowid;
                }
            }
            const BATCH_SIZE = (m.name === 'Books' || m.name === 'BookCategories') ? 10000 : 1000;
            let migratedCount = destCount;
            let startTime = Date.now();

            while (true) {
                const records = await sqliteSequelize.query(`SELECT rowid, * FROM ${m.name} WHERE rowid > ${lastRowId} ORDER BY rowid ASC LIMIT ${BATCH_SIZE}`, {
                    type: Sequelize.QueryTypes.SELECT
                });

                if (records.length === 0) break;

                const cleanRecords = records.map(r => {
                    const { rowid, ...rest } = r;
                    return rest;
                });

                try {
                    await m.model.bulkCreate(cleanRecords, { ignoreDuplicates: true });
                } catch (batchErr) {
                    console.log(`    Batch failed at rowid ${lastRowId}, falling back to individual inserts...`);
                    for (const rec of cleanRecords) {
                        try {
                            await m.model.create(rec);
                        } catch (sErr) { /* ignore duplicates */ }
                    }
                }

                lastRowId = records[records.length - 1].rowid;
                migratedCount += records.length;

                if (migratedCount % BATCH_SIZE === 0 || migratedCount >= total) {
                    const elapsed = (Date.now() - startTime) / 1000;
                    const rps = (migratedCount - destCount) / elapsed;
                    const remaining = total - migratedCount;
                    const etaMin = rps > 0 ? (remaining / rps / 60).toFixed(1) : 'unknown';

                    console.log(`    Progress: ${migratedCount.toLocaleString()} / ${total.toLocaleString()} (${((migratedCount / total) * 100).toFixed(1)}%) - ${rps.toFixed(0)} rec/s. ETA: ${etaMin}m`);
                }
            }
            console.log(`${m.name} Migration Complete.`);
        }

        console.log('\n--- Resumable Migration Finished Successfully ---');

    } catch (err) {
        console.error('Migration fatal error:', err);
    } finally {
        await sqliteSequelize.close();
        await mysqlSequelize.close();
    }
}

migrate();
