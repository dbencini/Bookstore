const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BookCategory = sequelize.define('BookCategory', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    BookId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    CategoryId: {
        type: DataTypes.UUID,
        allowNull: false
    }
}, {
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['BookId', 'CategoryId']
        }
    ]
});

module.exports = BookCategory;
