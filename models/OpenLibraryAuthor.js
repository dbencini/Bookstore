const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OpenLibraryAuthor = sequelize.define('OpenLibraryAuthor', {
    author_id: {
        type: DataTypes.STRING(50),
        primaryKey: true
    },
    name: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    tableName: 'open_library_authors',
    timestamps: true
});

module.exports = OpenLibraryAuthor;
