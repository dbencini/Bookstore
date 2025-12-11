const { sequelize, Book } = require('./models');

const updates = [
    { title: 'The Great Gatsby', category: 'Classics' },
    { title: '1984', category: 'Science Fiction' },
    { title: 'To Kill a Mockingbird', category: 'Classics' },
    { title: 'Pride and Prejudice', category: 'Romance' },
    { title: 'The Catcher in the Rye', category: 'Fiction' }
];

async function seedCategories() {
    try {
        await sequelize.sync({ alter: true });
        for (const update of updates) {
            const book = await Book.findOne({ where: { title: update.title } });
            if (book) {
                book.category = update.category;
                await book.save();
                console.log(`Updated ${book.title} to ${book.category}`);
            }
        }
    } catch (error) {
        console.error('Error seeding categories:', error);
    } finally {
        await sequelize.close();
    }
}

seedCategories();
