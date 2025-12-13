const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FooterSetting = sequelize.define('FooterSetting', {
    facebookUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    twitterUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    instagramUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    linkedinUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    youtubeUrl: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

module.exports = FooterSetting;
