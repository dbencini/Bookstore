require('dotenv').config();
const { sequelize } = require('./models');

async function run() {
    const query = "+Odyssey* +Animals*";

    console.log(`Query: ${query}`);

    let start = Date.now();
    const [books] = await sequelize.query(`
        SELECT id FROM books 
        WHERE isVisible = true 
        AND MATCH(title, author) AGAINST(:search IN BOOLEAN MODE)
        LIMIT 8
    `, { replacements: { search: query } });
    console.log(`SELECT (LIMIT 8) took: ${Date.now() - start}ms - Found: ${books.length}`);

    start = Date.now();
    const [countRes] = await sequelize.query(`
        SELECT COUNT(*) as count FROM books 
        WHERE isVisible = true 
        AND MATCH(title, author) AGAINST(:search IN BOOLEAN MODE)
    `, { replacements: { search: query } });
    console.log(`COUNT(*) took: ${Date.now() - start}ms - Total: ${countRes[0].count}`);

    process.exit(0);
}

run();
