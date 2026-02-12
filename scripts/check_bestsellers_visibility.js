require('dotenv').config();
const { Book, Category, BookCategory } = require('../models');

async function checkBestsellers() {
    try {
        const bestsellerCat = await Category.findOne({ where: { name: 'Bestseller' } });
        if (!bestsellerCat) {
            console.log('Bestseller category not found.');
            process.exit(0);
        }

        const links = await BookCategory.findAll({ where: { CategoryId: bestsellerCat.id } });
        console.log(`Found ${links.length} links in Bestseller category.`);

        for (const link of links) {
            const book = await Book.findByPk(link.BookId);
            console.log(`Book: ${book.title}`);
            console.log(`- isVisible: ${book.isVisible}`);
            console.log(`- Author: ${book.author}`);
            console.log(`- Description Snippet: ${book.description ? book.description.substring(0, 50) : 'NULL'}`);
        }
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

checkBestsellers();
