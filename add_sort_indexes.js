const sequelize = require('./config/database');
const { QueryTypes } = require('sequelize');

async function addSortIndexes() {
    console.log('Starting index creation on Books (createdAt, updatedAt)...');
    console.log('This may take several minutes for ~5 million records.');

    const startTime = Date.now();

    try {
        // Add createdAt index
        const [res1] = await sequelize.query("SHOW INDEX FROM Books WHERE Key_name = 'books_created_at'");
        if (res1.length === 0) {
            console.log('Creating index "books_created_at"...');
            await sequelize.query('CREATE INDEX books_created_at ON Books (createdAt) ALGORITHM=INPLACE LOCK=NONE', {
                type: QueryTypes.RAW
            });
            console.log('Done.');
        } else {
            console.log('Index "books_created_at" already exists.');
        }

        // Add updatedAt index
        const [res2] = await sequelize.query("SHOW INDEX FROM Books WHERE Key_name = 'books_updated_at'");
        if (res2.length === 0) {
            console.log('Creating index "books_updated_at"...');
            await sequelize.query('CREATE INDEX books_updated_at ON Books (updatedAt) ALGORITHM=INPLACE LOCK=NONE', {
                type: QueryTypes.RAW
            });
            console.log('Done.');
        } else {
            console.log('Index "books_updated_at" already exists.');
        }

        const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
        console.log(`Successfully completed indexing in ${duration} minutes.`);

    } catch (err) {
        console.error('Error creating index:', err.message);
        console.log('Attempting fallback without INPLACE/NONE...');
        try {
            await sequelize.query('CREATE INDEX books_created_at ON Books (createdAt)');
            await sequelize.query('CREATE INDEX books_updated_at ON Books (updatedAt)');
            console.log('Successfully created indexes using fallback.');
        } catch (fallbackErr) {
            console.error('Fallback failed:', fallbackErr.message);
        }
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

addSortIndexes();
