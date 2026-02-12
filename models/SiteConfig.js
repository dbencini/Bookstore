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
    themeColor: {
        type: DataTypes.STRING,
        defaultValue: '#0d6efd'
    },
    theme: {
        type: DataTypes.STRING,
        defaultValue: 'light'
    },
    sandboxPayfast: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    sandboxCloudPrint: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    adminDashboardStats: {
        type: DataTypes.JSON,
        defaultValue: {}
    }
});

module.exports = SiteConfig;
