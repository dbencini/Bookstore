const { sequelize, Book } = require('./models');

(async () => {
    try {
        await sequelize.authenticate();

        // Count missing authors
        const [results] = await sequelize.query(`
            SELECT 
                SUM(CASE WHEN author IS NULL THEN 1 ELSE 0 END) as null_count,
                SUM(CASE WHEN author = '' THEN 1 ELSE 0 END) as empty_count,
                SUM(CASE WHEN author = 'Unknown' THEN 1 ELSE 0 END) as unknown_count,
                COUNT(*) as total
            FROM books
        `);

        console.log('Author Stats:');
        console.log('-------------');
        console.log('NULL:', results[0].null_count);
        console.log('Empty string:', results[0].empty_count);
        console.log('Unknown:', results[0].unknown_count);
        console.log('Total books:', results[0].total);
        console.log('Missing (sum):', parseInt(results[0].null_count) + parseInt(results[0].empty_count) + parseInt(results[0].unknown_count));

        // Get sample ISBNs with missing authors
        const [samples] = await sequelize.query(`
            SELECT isbn, title, author 
            FROM books 
            WHERE author IS NULL OR author = '' OR author = 'Unknown'
            LIMIT 10
        `);

        console.log('\nSample ISBNs missing authors:');
        samples.forEach(b => console.log(`${b.isbn} - ${b.title}`));

        await sequelize.close();
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
})();
