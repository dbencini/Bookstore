require('dotenv').config();
const { sequelize } = require('../models');
const fs = require('fs');
const path = require('path');

async function checkBookIndexes() {
    try {
        const [results] = await sequelize.query('SHOW INDEX FROM books');
        const outputPath = path.join(__dirname, 'book_indexes_output.json');
        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
        console.log(`Indexes written to ${outputPath}`);
    } catch (error) {
        console.error('Failed to check indexes:', error);
    } finally {
        await sequelize.close();
    }
}

checkBookIndexes();
