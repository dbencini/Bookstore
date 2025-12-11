const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserType = sequelize.define('UserType', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING, // 'Admin', 'Customer', 'Guest'
        allowNull: false,
        unique: true
    }
});

module.exports = UserType;
