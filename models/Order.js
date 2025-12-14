const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    total: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'pending' // pending, completed
    },
    fulfillmentStatus: {
        type: DataTypes.STRING, // 'unfulfilled', 'shipped'
        defaultValue: 'unfulfilled'
    }
});

module.exports = Order;
