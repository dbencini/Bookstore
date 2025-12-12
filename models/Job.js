const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Job = sequelize.define('Job', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'running' // running, completed, failed
    },
    type: {
        type: DataTypes.STRING,
        defaultValue: 'manual_import' // manual_import, cron_import
    },
    summary: {
        type: DataTypes.TEXT
    },
    booksAdded: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    startTime: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    endTime: {
        type: DataTypes.DATE
    }
});

module.exports = Job;
