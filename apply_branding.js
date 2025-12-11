const { sequelize, SiteConfig } = require('./models');

async function applyBranding() {
    try {
        await sequelize.sync();
        const config = await SiteConfig.findOne();
        if (config) {
            config.appName = 'POD';
            config.logoUrl = '/images/Logos/POD_Logo1.webp';
            await config.save();
            console.log('Branding updated to POD.');
        } else {
            await SiteConfig.create({
                appName: 'POD',
                logoUrl: '/images/Logos/POD_Logo1.webp',
                theme: 'light'
            });
            console.log('Branding created for POD.');
        }
    } catch (error) {
        console.error('Error applying branding:', error);
    } finally {
        await sequelize.close();
    }
}

applyBranding();
