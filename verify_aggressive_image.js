require('dotenv').config();
const { Book, sequelize } = require('./models');

async function verifyAggressiveUpdate() {
    try {
        await sequelize.authenticate();
        console.log('Connected.');

        // 1. Manually set a book to have a default cover
        const isbn = '9780645525526';
        const book = await Book.findOne({ where: { isbn } });

        if (!book) {
            console.error('Book not found to test.');
            process.exit(1);
        }

        console.log(`Current Image: ${book.imageUrl}`);

        // Ensure it's treated as "needs repair"
        book.imageUrl = '/images/default_cover.svg';
        await book.save();
        console.log('Set to default_cover.svg for testing.');

        // 2. Trigger the repair logic manually for this one book
        // We'll just call the service logic or simulate it
        const { fixBookData } = require('./services/bookService');
        console.log('Starting repair job...');
        await fixBookData();

        console.log('Job started. Please wait for the background process to hit this ISBN.');
        console.log('In a real test, we would wait, but since I am an agent, I will check in 10 seconds.');

        await new Promise(r => setTimeout(r, 15000));

        await book.reload();
        console.log(`New Image: ${book.imageUrl}`);

        if (book.imageUrl.includes('http')) {
            console.log('SUCCESS: Image updated regardless of existing placeholder!');
        } else {
            console.log('FAILURE: Image still placeholder.');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

verifyAggressiveUpdate();
