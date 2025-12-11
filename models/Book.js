const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Book = sequelize.define('Book', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    author: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    imageUrl: {
        type: DataTypes.STRING,
        defaultValue: 'https://placehold.co/200x300'
    },
    stock: {
        type: DataTypes.INTEGER,
        defaultValue: 10
    },
    category: {
        type: DataTypes.STRING,
        defaultValue: 'General'
    },
    categoryId: {
        type: DataTypes.UUID,
        allowNull: true // Will be populated by migration
    },
    isVisible: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
});

module.exports = Book;
