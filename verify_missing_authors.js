require('dotenv').config();
const { sequelize, Book } = require('./models');
const { Op } = require('sequelize');

async function verifyStats() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB.');

        const total = await Book.count();
        const withAuthors = await Book.count({
            where: {
                author: {
                    [Op.and]: [
                        { [Op.ne]: null },
                        { [Op.ne]: '' },
                        { [Op.ne]: 'Unknown' }
                    ]
                }
            }
        });

        const missingAuthors = total - withAuthors;

        console.log('-----------------------------------');
        console.log(`Total Books:    ${total.toLocaleString()}`);
        console.log(`With Authors:   ${withAuthors.toLocaleString()}`);
        console.log(`Missing Authors:${missingAuthors.toLocaleString()}`);
        console.log('-----------------------------------');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

verifyStats();
