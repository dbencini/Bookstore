const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BookSubject = sequelize.define('BookSubject', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    BookId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    SubjectId: {
        type: DataTypes.UUID,
        allowNull: false
    }
}, {
    tableName: 'book_subjects',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['BookId', 'SubjectId']
        }
    ]
});

module.exports = BookSubject;
