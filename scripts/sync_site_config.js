require('dotenv').config();
const { sequelize, SiteConfig } = require('../models');

async function syncModel() {
    try {
        console.log('Syncing SiteConfig model...');
        await SiteConfig.sync({ alter: true });
        console.log('SiteConfig synced.');
    } catch (err) {
        console.error('Sync failed:', err);
    } finally {
        await sequelize.close();
    }
}

syncModel();
