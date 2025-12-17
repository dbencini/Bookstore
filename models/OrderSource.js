const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderSource = sequelize.define('OrderSource', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    }
}, {
    timestamps: false
});

module.exports = OrderSource;
