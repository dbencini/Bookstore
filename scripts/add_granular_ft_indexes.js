require('dotenv').config();
const { sequelize } = require('../models');

async function addGranularFTIndexes() {
    console.log('--- Adding Granular FULLTEXT Indexes ---');
    try {
        // Title
        try {
            console.log('Adding FULLTEXT index on Title...');
            await sequelize.query('ALTER TABLE books ADD FULLTEXT idx_title_ft(title)');
            console.log('Title index added.');
        } catch (err) {
            if (err.parent && err.parent.errno === 1061) console.log('Title index already exists.');
            else console.error('Error adding Title index:', err.message);
        }

        // Author
        try {
            console.log('Adding FULLTEXT index on Author...');
            await sequelize.query('ALTER TABLE books ADD FULLTEXT idx_author_ft(author)');
            console.log('Author index added.');
        } catch (err) {
            if (err.parent && err.parent.errno === 1061) console.log('Author index already exists.');
            else console.error('Error adding Author index:', err.message);
        }

        // Description
        try {
            console.log('Adding FULLTEXT index on Description...');
            await sequelize.query('ALTER TABLE books ADD FULLTEXT idx_description_ft(description)');
            console.log('Description index added.');
        } catch (err) {
            if (err.parent && err.parent.errno === 1061) console.log('Description index already exists.');
            else console.error('Error adding Description index:', err.message);
        }

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await sequelize.close();
    }
}

addGranularFTIndexes();
