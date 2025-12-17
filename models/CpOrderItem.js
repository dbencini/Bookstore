const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CpOrderItem = sequelize.define('CpOrderItem', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    cpItemId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    productCode: {
        type: DataTypes.STRING
    },
    quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    title: {
        type: DataTypes.STRING
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'pending'
    }
}, {
    tableName: 'cp_order_items'
});

module.exports = CpOrderItem;
