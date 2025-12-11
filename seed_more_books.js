const { sequelize, Book } = require('./models');

const newBooks = [
    // Non-Fiction
    { title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari', price: 15.99, category: 'Non-Fiction', description: 'A brief history of humankind.' },
    { title: 'Educated', author: 'Tara Westover', price: 14.99, category: 'Non-Fiction', description: 'A memoir about growing up in a survivalist family.' },

    // Children's
    { title: 'The Very Hungry Caterpillar', author: 'Eric Carle', price: 6.99, category: 'Children\'s', description: 'A classic picture book.' },
    { title: 'Harry Potter and the Sorcerer\'s Stone', author: 'J.K. Rowling', price: 12.99, category: 'Children\'s', description: 'A young wizard\'s journey begins.' },

    // Science Fiction (Adding more)
    { title: 'Dune', author: 'Frank Herbert', price: 18.99, category: 'Science Fiction', description: 'A scifi masterpiece set on Arrakis.' },

    // Bestsellers (New category for specific highlighting)
    { title: 'The Thursday Murder Club', author: 'Richard Osman', price: 10.00, category: 'Bestsellers', description: 'A clever and funny mystery.' },
    { title: 'Atomic Habits', author: 'James Clear', price: 16.00, category: 'Bestsellers', description: 'Tiny changes, remarkable results.' }
];

async function seedMore() {
    try {
        await sequelize.sync({ alter: true });
        for (const bookData of newBooks) {
            await Book.create(bookData);
            console.log(`Added: ${bookData.title}`);
        }
    } catch (error) {
        console.error('Error seeding more books:', error);
    } finally {
        await sequelize.close();
    }
}

seedMore();
