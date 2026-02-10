require('dotenv').config();
const { sequelize } = require('./models');

async function checkStats() {
    try {
        await sequelize.authenticate();
        console.log('Connected.');

        const [mappings] = await sequelize.query('SELECT COUNT(*) as count FROM isbn_author_mappings');
        const [authors] = await sequelize.query('SELECT COUNT(*) as count FROM open_library_authors');

        console.log('-----------------------------------');
        console.log(`ISBN Mappings: ${mappings[0].count.toLocaleString()}`);
        console.log(`Unique Authors: ${authors[0].count.toLocaleString()}`);
        console.log('-----------------------------------');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkStats();
