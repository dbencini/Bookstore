const { sequelize, SiteConfig } = require('./models');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');
        // Use alter: true to update schema (may drop columns depending on dialect support, or just add/modify)
        // SQLite support for dropping columns is limited in some versions but alter works for many things.
        await SiteConfig.sync({ alter: true });
        console.log('SiteConfig synced successfully.');
    } catch (err) {
        console.error('Error syncing SiteConfig:', err);
    } finally {
        await sequelize.close();
    }
})();
