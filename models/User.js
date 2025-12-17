const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcrypt');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    googleId: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    password_hash: {
        type: DataTypes.STRING,
        allowNull: true
    },
    addressStreet: {
        type: DataTypes.STRING,
        allowNull: true
    },
    addressTown: {
        type: DataTypes.STRING,
        allowNull: true
    },
    addressCity: {
        type: DataTypes.STRING,
        allowNull: true
    },
    addressProvince: {
        type: DataTypes.STRING,
        allowNull: true
    },
    addressZip: {
        type: DataTypes.STRING,
        allowNull: true
    },
    addressCountry: {
        type: DataTypes.STRING,
        allowNull: true
    },
    emailVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    userTypeId: {
        type: DataTypes.UUID,
        allowNull: true // Should be false eventually, but true for flexibility during migration/seeding if needed
    }
});

// Method to verify password
User.prototype.validPassword = function (password) {
    if (!this.password_hash) return false;
    return bcrypt.compareSync(password, this.password_hash);
};

module.exports = User;
