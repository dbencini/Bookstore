const { sequelize, User, Book } = require('../models');
const bcrypt = require('bcrypt');

async function seed() {
    try {
        await sequelize.sync({ force: true }); // Reset DB
        console.log('Database synced.');

        // Create Test User
        const passwordHash = bcrypt.hashSync('password123', 10);
        await User.create({
            name: 'Test User',
            email: 'test@example.com',
            password_hash: passwordHash
        });
        console.log('Test user created: test@example.com / password123');

        // Create Dummy Books
        const books = [
            {
                title: 'The Great Gatsby',
                author: 'F. Scott Fitzgerald',
                description: 'A novel about the American dream.',
                price: 12.99,
                stock: 50
            },
            {
                title: '1984',
                author: 'George Orwell',
                description: 'Dystopian social science fiction.',
                price: 15.50,
                stock: 30
            },
            {
                title: 'To Kill a Mockingbird',
                author: 'Harper Lee',
                description: 'A novel about racial injustice.',
                price: 10.99,
                stock: 20
            },
            {
                title: 'Pride and Prejudice',
                author: 'Jane Austen',
                description: 'Romantic novel of manners.',
                price: 9.99,
                stock: 15
            },
            {
                title: 'The Catcher in the Rye',
                author: 'J.D. Salinger',
                description: 'A story about teenage angst.',
                price: 11.49,
                stock: 0 // Out of stock
            }
        ];

        await Book.bulkCreate(books);
        console.log('Dummy books created.');

        process.exit(0);
    } catch (err) {
        console.error('Failed to seed:', err);
        process.exit(1);
    }
}

seed();
