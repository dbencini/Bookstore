const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CpFile = sequelize.define('CpFile', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    type: DataTypes.STRING, // 'cover', 'book', 'shipping_label'
    url: DataTypes.STRING,
    md5sum: DataTypes.STRING,
    format: DataTypes.STRING,
    localPath: DataTypes.STRING
}, {
    tableName: 'cp_files'
});

module.exports = CpFile;
