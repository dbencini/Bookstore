require('dotenv').config();
const { Category, BookCategory, sequelize } = require('./models');
const { Op } = require('sequelize');

async function restoreCategories() {
    console.log('--- CATEGORY RESTORATION & PURGE ENGINE ---');

    try {
        await sequelize.authenticate();
        console.log('[1/4] Connected to database.');

        // 1. Load Curated Categories
        const curated = await Category.findAll({
            where: { subject_triggers: { [Op.ne]: null } },
            raw: true
        });

        if (curated.length === 0) {
            console.error('ERROR: No curated categories (with triggers) found. Aborting safety check.');
            return;
        }

        console.log(`[2/4] Loaded ${curated.length} real categories.`);
        const [defaultCat] = await Category.findOrCreate({ where: { name: 'New Books' } });
        console.log(`Default Category: ${defaultCat.name} (${defaultCat.id})`);

        // 2. Identify Junk Categories
        const junkCategories = await Category.findAll({
            where: {
                subject_triggers: null,
                name: { [Op.ne]: 'New Books' } // Protect "New Books"
            },
            attributes: ['id', 'name'],
            raw: true
        });

        console.log(`[3/4] Identified ${junkCategories.toLocaleString()} junk categories to process.`);

        const startTime = Date.now();
        let processed = 0;
        let mapped = 0;

        // 3. Process Junk Categories in Batches
        const BATCH_SIZE = 500;
        for (let i = 0; i < junkCategories.length; i += BATCH_SIZE) {
            const batch = junkCategories.slice(i, i + BATCH_SIZE);

            await sequelize.transaction(async (t) => {
                for (const junk of batch) {
                    processed++;
                    const cleanJunkName = junk.name.toLowerCase();
                    let targetId = defaultCat.id;

                    // Try to map to a real category trigger
                    for (const cat of curated) {
                        const triggers = cat.subject_triggers.split(',').map(tr => tr.trim().toLowerCase());
                        if (triggers.some(tr => cleanJunkName.includes(tr))) {
                            targetId = cat.id;
                            mapped++;
                            break;
                        }
                    }

                    // Move links using raw SQL for speed (INSERT IGNORE to avoid double-assignment)
                    // Then delete old links.
                    // Actually, UPDATE IGNORE is better if CategoryId is part of a unique key.
                    // BookCategory usually has unique(BookId, CategoryId)

                    await sequelize.query(
                        `INSERT IGNORE INTO book_category (BookId, CategoryId, createdAt, updatedAt) 
                         SELECT BookId, :targetId, NOW(), NOW() FROM book_category WHERE CategoryId = :junkId`,
                        {
                            replacements: { targetId, junkId: junk.id },
                            transaction: t,
                            type: sequelize.QueryTypes.INSERT
                        }
                    );

                    // Delete links to the record we are about to delete
                    await sequelize.query(
                        `DELETE FROM book_category WHERE CategoryId = :junkId`,
                        {
                            replacements: { junkId: junk.id },
                            transaction: t,
                            type: sequelize.QueryTypes.DELETE
                        }
                    );

                    // Delete the junk category itself
                    await Category.destroy({ where: { id: junk.id }, transaction: t });
                }
            });

            if (processed % 1000 === 0 || processed === junkCategories.length) {
                const elapsed = (Date.now() - startTime) / 1000;
                console.log(`  Processed: ${processed.toLocaleString()} | Mapped to Triggers: ${mapped.toLocaleString()} | Rate: ${(processed / elapsed).toFixed(1)}/s`);
            }
        }

        console.log('[4/4] Cleanup Complete!');
        process.exit(0);
    } catch (err) {
        console.error('FATAL ERROR during restoration:', err);
        process.exit(1);
    }
}

restoreCategories();
