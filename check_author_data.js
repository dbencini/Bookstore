// Check what the "missing author" books actually contain
require('dotenv').config();
const { sequelize } = require('./models');

async function checkAuthorData() {
    console.log('🔍 Checking what "missing author" books contain...\n');

    try {
        // Sample books missing authors
        const [samples] = await sequelize.query(`
            SELECT id, title, author, isbn
            FROM books 
            WHERE (author IS NULL OR author = '' OR author = 'Unknown')
            AND isbn IS NOT NULL AND isbn != ''
            LIMIT 10
        `);

        console.log('📚 Sample books marked as "missing authors":\n');
        samples.forEach((book, i) => {
            console.log(`${i + 1}. "${book.title}"`);
            console.log(`   ISBN: ${book.isbn}`);
            console.log(`   Author field: ${book.author === null ? 'NULL' : `"${book.author}"`}\n`);
        });

        // Check if any have author keys (like /authors/OL123A)
        const [withKeys] = await sequelize.query(`
            SELECT COUNT(*) as count
            FROM books 
            WHERE author LIKE '/authors/%'
        `);

        console.log(`\n📊 Books with author keys (e.g., "/authors/OL123A"): ${withKeys[0].count.toLocaleString()}`);

        if (withKeys[0].count > 0) {
            const [keySamples] = await sequelize.query(`
                SELECT id, title, author, isbn
                FROM books 
                WHERE author LIKE '/authors/%'
                LIMIT 5
            `);

            console.log('\n🔑 Sample books with author keys:\n');
            keySamples.forEach((book, i) => {
                console.log(`${i + 1}. "${book.title}"`);
                console.log(`   Author key: ${book.author}\n`);
            });
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await sequelize.close();
    }
}

checkAuthorData();
