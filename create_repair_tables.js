/**
 * Create tables for stable author repair in MySQL
 * Loads .env before connecting to database
 */

// Load environment variables FIRST
require('dotenv').config();

const { sequelize } = require('./models');

async function createRepairTables() {
    console.log(`Creating repair tables in ${process.env.DB_DIALECT || 'sqlite'}...`);
    console.log(`Database: ${process.env.DB_NAME || 'sqlite file'}`);

    try {
        // ISBN to Author mappings table
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS isbn_author_mappings (
                isbn VARCHAR(20) PRIMARY KEY,
                author_keys TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_isbn (isbn)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        console.log('✅ Created isbn_author_mappings table');

        // Repair checkpoints table
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS repair_checkpoints (
                job_id VARCHAR(36) PRIMARY KEY,
                phase VARCHAR(50) NOT NULL,
                last_position BIGINT DEFAULT 0,
                last_book_id VARCHAR(36) DEFAULT NULL,
                records_processed BIGINT DEFAULT 0,
                mappings_created BIGINT DEFAULT 0,
                books_updated BIGINT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_job_phase (job_id, phase)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        console.log('✅ Created repair_checkpoints table');
        console.log('\n✅ All repair tables created successfully!');

    } catch (err) {
        console.error('❌ Error:', err.message);
        throw err;
    } finally {
        await sequelize.close();
    }
}

if (require.main === module) {
    createRepairTables()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = { createRepairTables };
