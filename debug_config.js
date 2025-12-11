const { sequelize, SiteConfig } = require('./models');

async function debugConfig() {
    try {
        const configs = await SiteConfig.findAll();
        console.log('Current SiteConfigs:', JSON.stringify(configs, null, 2));
    } catch (error) {
        console.error('Error fetching config:', error);
    } finally {
        await sequelize.close();
    }
}

debugConfig();
