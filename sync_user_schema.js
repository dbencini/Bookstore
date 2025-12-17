const { sequelize, User } = require('./models');

async function syncUserSchema() {
    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        console.log('Syncing User table schema...');
        await User.sync({ alter: true });
        console.log('User table synced successfully.');

    } catch (err) {
        console.error('Error syncing User schema:', err);
    } finally {
        await sequelize.close();
    }
}

syncUserSchema();
