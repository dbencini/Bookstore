const sequelize = require('./config/database');
const { QueryTypes } = require('sequelize');

async function addAuthorIndex() {
    console.log('Starting index creation on Books (author)...');
    console.log('This may take several minutes for ~5 million records.');

    const startTime = Date.now();

    try {
        // Check if index already exists
        const [results] = await sequelize.query("SHOW INDEX FROM Books WHERE Key_name = 'books_author'");

        if (results.length > 0) {
            console.log('Index "books_author" already exists.');
            process.exit(0);
        }

        // Add index
        await sequelize.query('CREATE INDEX books_author ON Books (author) ALGORITHM=INPLACE LOCK=NONE', {
            type: QueryTypes.RAW
        });

        const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
        console.log(`Successfully created index "books_author" in ${duration} minutes.`);

    } catch (err) {
        console.error('Error creating index:', err.message);
        console.log('Attempting fallback without INPLACE/NONE...');
        try {
            await sequelize.query('CREATE INDEX books_author ON Books (author)');
            console.log('Successfully created index using fallback.');
        } catch (fallbackErr) {
            console.error('Fallback failed:', fallbackErr.message);
        }
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

addAuthorIndex();
