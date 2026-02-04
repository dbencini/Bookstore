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
    isbn: {
        type: DataTypes.STRING,
        allowNull: true
    },
    description: {
        type: DataTypes.STRING(4000)
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
        allowNull: true
    },
    JobId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    isVisible: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    price_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    bind: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        allowNull: true
    },
    pur: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    indexes: [
        { unique: true, fields: ['isbn'] },
        { fields: ['title'] }
    ]
});

module.exports = Book;
