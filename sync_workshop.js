const { sequelize, Workshop } = require('./models');

async function syncWorkshop() {
    try {
        await sequelize.authenticate();
        console.log('Connected. Altering Workshop table...');

        await Workshop.sync({ alter: true });

        console.log('Workshop table synced successfully.');
    } catch (err) {
        console.error('Error syncing Workshop:', err);
    } finally {
        await sequelize.close();
    }
}

syncWorkshop();
