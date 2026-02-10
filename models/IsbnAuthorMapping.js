const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const IsbnAuthorMapping = sequelize.define('IsbnAuthorMapping', {
    isbn: {
        type: DataTypes.STRING(20),
        primaryKey: true
    },
    author_keys: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    tableName: 'isbn_author_mappings',
    timestamps: true
});

module.exports = IsbnAuthorMapping;
