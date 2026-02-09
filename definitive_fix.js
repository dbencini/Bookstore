require('dotenv').config();
const { sequelize } = require('./models');

async function fix() {
    console.log('Exhaustive Fix Starting...');
    try {
        await sequelize.query('SET foreign_key_checks = 0');

        // Audit based on indexes_dump.json
        const drops = [
            'books_author',       // Blocking expansion
            'idx_books_author',   // Blocking expansion
            'idx_books_isbn',     // Redundant with books_isbn (unique)
            'idx_books_title'     // Redundant with books_title
        ];

        for (const idx of drops) {
            try {
                await sequelize.query(`DROP INDEX ${idx} ON Books`);
                console.log(`- Dropped index ${idx}`);
            } catch (e) {
                console.log(`- (Skip) ${idx}: ${e.message}`);
            }
        }

        console.log('2. Attempting ALTER TABLE...');
        await sequelize.query('ALTER TABLE Books MODIFY author VARCHAR(2000) NOT NULL');
        console.log('2. ALTER TABLE Books - SUCCESS');

        try {
            await sequelize.query('CREATE INDEX idx_books_author ON Books (author(255))');
            console.log('3. Prefix index recreated.');
        } catch (e) {
            console.log('3. (Warning) Could not recreate index:', e.message);
        }

        await sequelize.query('SET foreign_key_checks = 1');

        const [results] = await sequelize.query('DESCRIBE Books');
        const authorInfo = results.find(f => f.Field === 'author');
        console.log('VERIFICATION - Author Column:', JSON.stringify(authorInfo, null, 2));

        if (authorInfo.Type.toLowerCase().includes('2000')) {
            console.log('FINAL RESULT: SUCCESS - Author field is now 2000 chars.');
        } else {
            console.error('FINAL RESULT: FAILURE - Author field is still', authorInfo.Type);
        }

    } catch (err) {
        console.error('Fatal Error during expansion:', err);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}
fix();
