const { sequelize } = require('./models');

async function createRepairTablesV2() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Connected.');

        // 1. Create open_library_authors table
        console.log('Creating open_library_authors table...');
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS open_library_authors (
                author_id VARCHAR(50) PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ table open_library_authors created or already exists.');

        // 2. Ensure isbn_author_mappings is optimized
        // We want isbn to be indexed for fast lookups (it should already be PK)
        // and we might want to ensure it uses the same collation.
        console.log('Optimizing isbn_author_mappings table...');
        await sequelize.query(`
            ALTER TABLE isbn_author_mappings 
            MODIFY isbn VARCHAR(20),
            MODIFY author_keys TEXT;
        `);

        // Check if index exists on isbn (usually PK does this, but let's be safe)
        const [indexes] = await sequelize.query('SHOW INDEX FROM isbn_author_mappings WHERE Column_name = "isbn"');
        if (indexes.length === 0) {
            console.log('Adding index to isbn...');
            await sequelize.query('CREATE INDEX idx_isbn ON isbn_author_mappings(isbn)');
        }

        console.log('✅ Database optimization complete.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error creating tables:', err);
        process.exit(1);
    }
}

createRepairTablesV2();
