const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('./config/database');

const queryInterface = sequelize.getQueryInterface();

async function addIsbnColumn() {
    try {
        await queryInterface.addColumn('Books', 'isbn', {
            type: DataTypes.STRING,
            allowNull: true
        });
        console.log('Successfully added isbn column to Books table.');
    } catch (error) {
        console.error('Error adding isbn column:', error);
    } finally {
        await sequelize.close();
    }
}

addIsbnColumn();
