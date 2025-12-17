const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CpOrder = sequelize.define('CpOrder', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    cpOrderId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    clientReference: {
        type: DataTypes.STRING
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'received'
    },
    orderDate: {
        type: DataTypes.DATE
    },
    shippingDate: {
        type: DataTypes.DATE
    },
    fullJsonPayload: {
        type: DataTypes.TEXT
    }
}, {
    tableName: 'cp_orders'
});

module.exports = CpOrder;
