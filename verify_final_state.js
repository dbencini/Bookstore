require('dotenv').config();
const { Category, BookCategory, Book, sequelize } = require('./models');

async function verifyAll() {
    try {
        await sequelize.authenticate();
        const totalBooks = await Book.count();
        const totalLinks = await BookCategory.count();
        const linkedBooks = await BookCategory.count({ distinct: true, col: 'BookId' });

        console.log(`Total Books: ${totalBooks.toLocaleString()}`);
        console.log(`Total Links: ${totalLinks.toLocaleString()}`);
        console.log(`Unique Linked Books: ${linkedBooks.toLocaleString()}`);
        console.log(`Unlinked Books: ${(totalBooks - linkedBooks).toLocaleString()}`);

        const cats = await Category.findAll({ order: [['book_count', 'DESC']] });
        cats.forEach(c => {
            console.log(`${c.name.padEnd(35)}: ${c.book_count.toLocaleString()} books`);
        });

        if (totalBooks === linkedBooks) {
            console.log('\nSUCCESS: All books are categorized.');
        } else {
            console.log('\nWARNING: Some books are still unlinked.');
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
verifyAll();
