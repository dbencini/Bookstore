require('dotenv').config();
const { sequelize } = require('./models');

async function expandAuthor() {
    try {
        await sequelize.authenticate();
        console.log('Connected. Running ALTER TABLE...');
        await sequelize.query('ALTER TABLE Books MODIFY author VARCHAR(2000) NOT NULL');
        console.log('ALTER TABLE Books MODIFY author VARCHAR(2000) NOT NULL - SUCCESS');

        const info = await sequelize.getQueryInterface().describeTable('Books');
        console.log('New Author Column Type:', info.author.type);

        process.exit(0);
    } catch (err) {
        console.error('Expansion failed:', err);
        process.exit(1);
    }
}

expandAuthor();
