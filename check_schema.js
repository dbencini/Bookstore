require('dotenv').config();
const { sequelize } = require('./models');

async function checkSchema() {
    try {
        await sequelize.authenticate();
        const info = await sequelize.getQueryInterface().describeTable('Books');
        console.log('Author Column Info:', JSON.stringify(info.author, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('Failed to describe table:', err);
        process.exit(1);
    }
}

checkSchema();
