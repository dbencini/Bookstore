const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define('Category', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    subject_triggers: {
        type: DataTypes.STRING(1000),
        allowNull: true
    },
    book_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    priority: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'category',
    timestamps: true
});

module.exports = Category;
