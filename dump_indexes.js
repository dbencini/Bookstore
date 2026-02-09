require('dotenv').config();
const { sequelize } = require('./models');
const fs = require('fs');

async function dumpIndexes() {
    try {
        await sequelize.authenticate();
        const indexes = await sequelize.getQueryInterface().showIndex('Books');
        fs.writeFileSync('indexes_dump.json', JSON.stringify(indexes, null, 2));
        console.log('Indexes dumped to indexes_dump.json');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

dumpIndexes();
