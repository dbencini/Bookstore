const { sequelize, SiteConfig } = require('./models');

async function syncSiteConfig() {
    try {
        await sequelize.authenticate();
        console.log('Connected. Syncing SiteConfig table...');

        // Alter table to add new columns if they don't exist
        await SiteConfig.sync({ alter: true });

        console.log('SiteConfig table synced successfully.');

    } catch (error) {
        console.error('Error syncing SiteConfig:', error);
    } finally {
        await sequelize.close();
    }
}

syncSiteConfig();
