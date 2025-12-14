const { sequelize, SiteConfig } = require('./models');

async function sync() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // Sync SiteConfig specifically with alter: true to add new columns
        await SiteConfig.sync({ alter: true });
        console.log('SiteConfig synced successfully.');

    } catch (error) {
        console.error('Sync failed:', error);
    } finally {
        await sequelize.close();
    }
}

sync();
