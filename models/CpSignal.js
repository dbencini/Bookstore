const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CpSignal = sequelize.define('CpSignal', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    signalType: DataTypes.STRING, // 'ItemProduce', 'ItemShipped', etc.
    payload: DataTypes.TEXT,
    sentAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    responseCode: DataTypes.INTEGER,
    responseBody: DataTypes.TEXT
}, {
    tableName: 'cp_signals'
});

module.exports = CpSignal;
