const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CategorySubject = sequelize.define('CategorySubject', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    CategoryId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    SubjectId: {
        type: DataTypes.UUID,
        allowNull: false
    }
}, {
    tableName: 'category_subjects',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['CategoryId', 'SubjectId']
        }
    ]
});

module.exports = CategorySubject;
