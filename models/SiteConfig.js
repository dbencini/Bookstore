const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SiteConfig = sequelize.define('SiteConfig', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    appName: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'My Bookstore'
    },
    logoUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    theme: {
        type: DataTypes.STRING,
        defaultValue: 'light'
    }
});

module.exports = SiteConfig;
