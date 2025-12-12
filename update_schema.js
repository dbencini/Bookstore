const { sequelize } = require('./models');

async function updateSchema() {
    try {
        console.log('Updating database schema...');
        await sequelize.sync({ alter: true });
        console.log('Schema updated successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error updating schema:', error);
        process.exit(1);
    }
}

updateSchema();
