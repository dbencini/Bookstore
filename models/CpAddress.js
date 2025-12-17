const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CpAddress = sequelize.define('CpAddress', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    type: {
        type: DataTypes.STRING // 'delivery', 'billing'
    },
    company: DataTypes.STRING,
    name: DataTypes.STRING,
    street1: DataTypes.STRING,
    street2: DataTypes.STRING,
    city: DataTypes.STRING,
    zip: DataTypes.STRING,
    country: DataTypes.STRING,
    state: DataTypes.STRING,
    email: DataTypes.STRING,
    phone: DataTypes.STRING
}, {
    tableName: 'cp_addresses'
});

module.exports = CpAddress;
