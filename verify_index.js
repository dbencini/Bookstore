const sequelize = require('./config/database');

async function verifyIndex() {
    try {
        console.log('--- Index List ---');
        const [indexes] = await sequelize.query("SHOW INDEX FROM Books");
        console.table(indexes.map(idx => ({
            Table: idx.Table,
            Column: idx.Column_name,
            IndexName: idx.Key_name
        })));

        console.log('\n--- EXPLAIN Search Query ---');
        // Simple search query test
        const [searchExplain] = await sequelize.query("EXPLAIN SELECT id, title FROM Books WHERE isVisible = true AND title LIKE '%test%'");
        console.table(searchExplain);

        console.log('\n--- EXPLAIN Initial View Query (Images Filtering) ---');
        // Filtering by image (initial view)
        const [filterExplain] = await sequelize.query(`
            EXPLAIN SELECT id, title FROM Books 
            WHERE imageUrl IS NOT NULL 
            AND imageUrl != '' 
            AND imageUrl != '/images/placeholder-book.png'
            AND imageUrl != 'https://placehold.co/200x300'
        `);
        console.table(filterExplain);

        const usedIndex = filterExplain[0].key;
        if (usedIndex === 'books_image_url') {
            console.log('\n✅ SUCCESS: The database is using the new "books_image_url" index!');
        } else {
            console.log('\n⚠️ WARNING: The database chose a different index or a full scan:', usedIndex || 'None');
        }

    } catch (err) {
        console.error('Verification failed:', err.message);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

verifyIndex();
