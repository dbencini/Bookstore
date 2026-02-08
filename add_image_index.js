const sequelize = require('./config/database');
const { QueryTypes } = require('sequelize');

async function addIndex() {
    console.log('Starting index creation on Books (imageUrl)...');
    console.log('This may take several minutes for ~5 million records.');

    const startTime = Date.now();

    try {
        // Check if index already exists
        const [results] = await sequelize.query("SHOW INDEX FROM Books WHERE Key_name = 'books_image_url'");

        if (results.length > 0) {
            console.log('Index "books_image_url" already exists.');
            process.exit(0);
        }

        // Add index
        // Using a standard CREATE INDEX. For MySQL 8.0+, this can be done ALGORITHM=INPLACE, LOCK=NONE for less impact.
        // But standard Sequelize query is safer for general compatibility unless we know the exact version.
        // "ALGORITHM=INPLACE" allows concurrent DML.
        await sequelize.query('CREATE INDEX books_image_url ON Books (imageUrl) ALGORITHM=INPLACE LOCK=NONE', {
            type: QueryTypes.RAW
        });

        const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
        console.log(`Successfully created index "books_image_url" in ${duration} minutes.`);

    } catch (err) {
        console.error('Error creating index:', err.message);
        console.log('Attempting fallback without INPLACE/NONE...');
        try {
            await sequelize.query('CREATE INDEX books_image_url ON Books (imageUrl)');
            console.log('Successfully created index using fallback.');
        } catch (fallbackErr) {
            console.error('Fallback failed:', fallbackErr.message);
        }
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

addIndex();
