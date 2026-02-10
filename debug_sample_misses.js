require('dotenv').config();
const { sequelize, Book } = require('./models');
const { Op } = require('sequelize');

async function debugMisses() {
    try {
        await sequelize.authenticate();
        console.log('Connected.');

        // 1. Get 5 books with missing authors that HAVE an ISBN
        const books = await Book.findAll({
            where: {
                author: { [Op.or]: [null, '', 'Unknown'] },
                isbn: { [Op.ne]: null, [Op.ne]: '' }
            },
            limit: 5,
            attributes: ['id', 'title', 'isbn']
        });

        console.log(`Checking ${books.length} sample books...`);

        for (const book of books) {
            console.log(`\nBook: "${book.title}" (ISBN: ${book.isbn})`);

            const isbnsToCheck = [];
            if (book.isbn) isbnsToCheck.push(book.isbn);

            if (isbnsToCheck.length === 0) {
                console.log(' - No valid ISBNs to check.');
                continue;
            }

            const [mappings] = await sequelize.query(
                `SELECT * FROM isbn_author_mappings WHERE isbn IN (:isbns)`,
                { replacements: { isbns: isbnsToCheck } }
            );

            if (mappings.length > 0) {
                console.log(` - MATCH FOUND in DB! Mappings: ${JSON.stringify(mappings)}`);
                console.log(` - FAIL: This book should have been repaired!`);
            } else {
                console.log(` - No match in local mappings table.`);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugMisses();
