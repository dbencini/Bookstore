const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderNote = sequelize.define('OrderNote', {
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    isCustomerVisible: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
});

module.exports = OrderNote;
