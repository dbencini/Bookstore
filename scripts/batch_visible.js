require('dotenv').config();
const { Book } = require('../models');
const { Op } = require('sequelize');

async function run() {
    console.log('Starting batched visibility update...');
    const BATCH_SIZE = 5000;
    let totalUpdated = 0;

    try {
        while (true) {
            // Update 10,000 hidden books at a time
            const [count] = await Book.update(
                { isVisible: 1 },
                {
                    where: { isVisible: 0 },
                    limit: BATCH_SIZE
                }
            );

            if (count === 0) break;

            totalUpdated += count;
            console.log(`Updated ${totalUpdated} books...`);
        }

        console.log(`Done! Total books made visible: ${totalUpdated}`);
        process.exit(0);
    } catch (e) {
        console.error('Batch Update Error:', e.message);
        process.exit(1);
    }
}

run();
