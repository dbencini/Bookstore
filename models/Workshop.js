const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Workshop = sequelize.define('Workshop', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    orderDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    isbn: {
        type: DataTypes.STRING,
        allowNull: true
    },
    bookTitle: {
        type: DataTypes.STRING,
        allowNull: false
    },
    threeKnife: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    threeKnifeDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    dispatch: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    dispatchDate: {
        type: DataTypes.DATE,
        allowNull: true
    }
});

module.exports = Workshop;
