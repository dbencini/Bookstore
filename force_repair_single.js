require('dotenv').config();
const { Book, sequelize } = require('./models');
const axios = require('axios');

async function forceRepairSingle(isbn) {
    try {
        await sequelize.authenticate();
        const book = await Book.findOne({ where: { isbn } });
        if (!book) return console.log('Book not found.');

        console.log(`Before: ${book.imageUrl}`);

        // Use the actual logic from bookService.js manually here
        const query = `isbn:${isbn}`;
        const response = await axios.get(`https://www.googleapis.com/books/v1/volumes?q=${query}&key=${process.env.GOOGLE_BOOK_API}`);
        const items = response.data.items || [];

        if (items.length > 0) {
            const info = items[0].volumeInfo;
            const newImageUrl = info.imageLinks ? (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail) : null;

            if (newImageUrl) {
                const cleanNewImage = newImageUrl.substring(0, 255);
                console.log(`Found New Image: ${cleanNewImage}`);
                if (book.imageUrl !== cleanNewImage) {
                    book.imageUrl = cleanNewImage;
                    await book.save();
                    console.log('Update Successful.');
                } else {
                    console.log('Image URL is identical, skipping.');
                }
            } else {
                console.log('No imageLinks in Google Books response.');
            }
        }

        const updatedBook = await Book.findOne({ where: { isbn } });
        console.log(`After: ${updatedBook.imageUrl}`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

forceRepairSingle('9780645525526');
