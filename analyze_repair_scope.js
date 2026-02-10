// Analyze how many books actually need author repair
require('dotenv').config();
const { sequelize, Book } = require('./models');

async function analyzeRepairScope() {
    console.log('📊 Analyzing author repair scope...\n');

    try {
        // Total books
        const totalBooks = await Book.count();
        console.log(`Total books in database: ${totalBooks.toLocaleString()}`);

        // Books missing authors
        const [missingAuthors] = await sequelize.query(`
            SELECT COUNT(*) as count 
            FROM books 
            WHERE (author IS NULL OR author = '' OR author = 'Unknown')
            AND isbn IS NOT NULL AND isbn != ''
        `);

        const needsRepair = missingAuthors[0].count;
        console.log(`Books needing author repair: ${needsRepair.toLocaleString()}`);
        console.log(`Percentage: ${((needsRepair / totalBooks) * 100).toFixed(1)}%\n`);

        // Books with ISBNs
        const [withIsbn] = await sequelize.query(`
            SELECT COUNT(*) as count 
            FROM books 
            WHERE isbn IS NOT NULL AND isbn != ''
        `);
        console.log(`Books with ISBNs: ${withIsbn[0].count.toLocaleString()}\n`);

        // Recommendation
        console.log('💡 RECOMMENDATION:');
        if (needsRepair < 100000) {
            console.log(`\n✅ With only ${needsRepair.toLocaleString()} books to fix, we should:`);
            console.log('   1. Extract the ISBNs that need lookup');
            console.log('   2. Search ONLY for those ISBNs in OpenLibraryBooks.txt');
            console.log('   3. This will be 100x faster than scanning all 55M records!\n');
        } else {
            console.log(`\n⚠️  With ${needsRepair.toLocaleString()} books to fix, consider:`);
            console.log('   - Building the full mapping table (current approach)');
            console.log('   - OR use batch API lookups with rate limiting\n');
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await sequelize.close();
    }
}

analyzeRepairScope();
