const { sequelize, Category } = require('../models');

async function sync() {
    try {
        await sequelize.authenticate();
        console.log('Connected to database.');
        await sequelize.sync({ alter: true });
        console.log('Database synced successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Sync failed:', err);
        process.exit(1);
    }
}

sync();
