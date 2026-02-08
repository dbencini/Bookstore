require('dotenv').config();
const { Book, Category, sequelize } = require('../models');

async function verify() {
    console.log('--- Verifying New Categorization (Sample) ---');

    const books = await Book.findAll({
        limit: 10,
        include: [{
            model: Category,
            through: { attributes: [] }
        }],
        order: [['createdAt', 'DESC']]
    });

    for (const book of books) {
        const catNames = book.Categories.map(c => c.name).join(', ') || 'Uncategorized';
        console.log(`[${book.title.substring(0, 40)}] -> Categories: ${catNames}`);
    }

    process.exit(0);
}

verify();
