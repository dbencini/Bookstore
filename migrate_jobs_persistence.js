const { Job } = require('./models');
const sequelize = require('./config/database');
const { QueryInterface, DataTypes } = require('sequelize');

async function migrate() {
    const queryInterface = sequelize.getQueryInterface();
    const tableInfo = await queryInterface.describeTable('Jobs');

    if (!tableInfo.lastProcessedId) {
        console.log('Adding lastProcessedId to Jobs...');
        await queryInterface.addColumn('Jobs', 'lastProcessedId', {
            type: DataTypes.STRING,
            allowNull: true
        });
    }

    if (!tableInfo.processedCount) {
        console.log('Adding processedCount to Jobs...');
        await queryInterface.addColumn('Jobs', 'processedCount', {
            type: DataTypes.INTEGER,
            defaultValue: 0
        });
    }

    if (!tableInfo.fixedCount) {
        console.log('Adding fixedCount to Jobs...');
        await queryInterface.addColumn('Jobs', 'fixedCount', {
            type: DataTypes.INTEGER,
            defaultValue: 0
        });
    }

    if (!tableInfo.removedCount) {
        console.log('Adding removedCount to Jobs...');
        await queryInterface.addColumn('Jobs', 'removedCount', {
            type: DataTypes.INTEGER,
            defaultValue: 0
        });
    }

    console.log('Migration complete.');
    process.exit();
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
