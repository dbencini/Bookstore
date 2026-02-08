const { sequelize, Book, BookCategory } = require('./models');

async function prepare() {
    console.log('--- PREPARING DATABASE FOR CLEAN START ---');

    try {
        await sequelize.authenticate();
        console.log('Connected to MySQL.');

        // 1. Add Column if not exists
        console.log('Adding import_comment column if missing...');
        const [results] = await sequelize.query("SHOW COLUMNS FROM Books LIKE 'import_comment'");
        if (results.length === 0) {
            await sequelize.query("ALTER TABLE Books ADD COLUMN import_comment VARCHAR(4000) NULL");
            console.log('Column import_comment added.');
        } else {
            console.log('Column import_comment already exists.');
        }

        // 2. Clear existing books and associations
        console.log('Wiping Books and BookCategories tables...');
        // We use TRUNCATE to reset IDs and clear fast, but need to disable FK checks
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        await sequelize.query('TRUNCATE TABLE BookCategories');
        await sequelize.query('TRUNCATE TABLE Books');
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('Success: Database wiped and ready for clean import.');

        process.exit(0);
    } catch (err) {
        console.error('Preparation failed:', err);
        process.exit(1);
    }
}

prepare();
