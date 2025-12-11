const { sequelize, User, UserType, Book } = require('./models');
const bcrypt = require('bcrypt');

const categories = {
    'Bestsellers': [
        { title: 'The Thursday Murder Club', author: 'Richard Osman', price: 10.00, imageUrl: 'https://placehold.co/200x300?text=Thursday+Club' },
        { title: 'Atomic Habits', author: 'James Clear', price: 16.00, imageUrl: 'https://placehold.co/200x300?text=Atomic+Habits' },
        { title: 'It Ends with Us', author: 'Colleen Hoover', price: 12.99, imageUrl: 'https://placehold.co/200x300?text=Ends+With+Us' },
        { title: 'Lessons in Chemistry', author: 'Bonnie Garmus', price: 14.99, imageUrl: 'https://placehold.co/200x300?text=Lessons+Chemistry' },
        { title: 'The Seven Husbands of Evelyn Hugo', author: 'Taylor Jenkins Reid', price: 11.99, imageUrl: 'https://placehold.co/200x300?text=Evelyn+Hugo' },
        { title: 'Verity', author: 'Colleen Hoover', price: 13.99, imageUrl: 'https://placehold.co/200x300?text=Verity' }
    ],
    'Fiction': [
        { title: 'The Catcher in the Rye', author: 'J.D. Salinger', price: 9.99, imageUrl: 'https://placehold.co/200x300?text=Catcher+Rye' },
        { title: 'The Kite Runner', author: 'Khaled Hosseini', price: 12.50, imageUrl: 'https://placehold.co/200x300?text=Kite+Runner' },
        { title: 'Life of Pi', author: 'Yann Martel', price: 10.99, imageUrl: 'https://placehold.co/200x300?text=Life+Pi' },
        { title: 'The Alchemist', author: 'Paulo Coelho', price: 11.00, imageUrl: 'https://placehold.co/200x300?text=Alchemist' },
        { title: 'The Midnight Library', author: 'Matt Haig', price: 13.50, imageUrl: 'https://placehold.co/200x300?text=Midnight+Library' },
        { title: 'Where the Crawdads Sing', author: 'Delia Owens', price: 14.00, imageUrl: 'https://placehold.co/200x300?text=Crawdads' }
    ],
    'Non-Fiction': [
        { title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari', price: 15.99, imageUrl: 'https://placehold.co/200x300?text=Sapiens' },
        { title: 'Educated', author: 'Tara Westover', price: 14.99, imageUrl: 'https://placehold.co/200x300?text=Educated' },
        { title: 'Becoming', author: 'Michelle Obama', price: 18.00, imageUrl: 'https://placehold.co/200x300?text=Becoming' },
        { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', price: 14.50, imageUrl: 'https://placehold.co/200x300?text=Thinking+Fast' },
        { title: 'Quiet', author: 'Susan Cain', price: 13.00, imageUrl: 'https://placehold.co/200x300?text=Quiet' },
        { title: 'Into the Wild', author: 'Jon Krakauer', price: 12.00, imageUrl: 'https://placehold.co/200x300?text=Into+Wild' }
    ],
    'Classics': [
        { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', price: 10.00, imageUrl: 'https://placehold.co/200x300?text=Gatsby' },
        { title: 'To Kill a Mockingbird', author: 'Harper Lee', price: 12.00, imageUrl: 'https://placehold.co/200x300?text=Mockingbird' },
        { title: 'Pride and Prejudice', author: 'Jane Austen', price: 8.99, imageUrl: 'https://placehold.co/200x300?text=Pride+Prejudice' },
        { title: '1984', author: 'George Orwell', price: 9.99, imageUrl: 'https://placehold.co/200x300?text=1984' },
        { title: 'Jane Eyre', author: 'Charlotte Bronte', price: 9.50, imageUrl: 'https://placehold.co/200x300?text=Jane+Eyre' },
        { title: 'Wuthering Heights', author: 'Emily Bronte', price: 9.50, imageUrl: 'https://placehold.co/200x300?text=Wuthering+Heights' }
    ],
    'Children\'s': [
        { title: 'The Very Hungry Caterpillar', author: 'Eric Carle', price: 6.99, imageUrl: 'https://placehold.co/200x300?text=Caterpillar' },
        { title: 'Harry Potter and the Sorcerer\'s Stone', author: 'J.K. Rowling', price: 12.99, imageUrl: 'https://placehold.co/200x300?text=Harry+Potter' },
        { title: 'Charlotte\'s Web', author: 'E.B. White', price: 8.99, imageUrl: 'https://placehold.co/200x300?text=Charlottes+Web' },
        { title: 'Green Eggs and Ham', author: 'Dr. Seuss', price: 7.99, imageUrl: 'https://placehold.co/200x300?text=Green+Eggs' },
        { title: 'Matilda', author: 'Roald Dahl', price: 9.99, imageUrl: 'https://placehold.co/200x300?text=Matilda' },
        { title: 'The Lion, the Witch and the Wardrobe', author: 'C.S. Lewis', price: 10.99, imageUrl: 'https://placehold.co/200x300?text=Narnia' }
    ],
    'Science Fiction': [
        { title: 'Dune', author: 'Frank Herbert', price: 18.99, imageUrl: 'https://placehold.co/200x300?text=Dune' },
        { title: 'Neuromancer', author: 'William Gibson', price: 14.00, imageUrl: 'https://placehold.co/200x300?text=Neuromancer' },
        { title: 'Ender\'s Game', author: 'Orson Scott Card', price: 11.99, imageUrl: 'https://placehold.co/200x300?text=Enders+Game' },
        { title: 'The Martian', author: 'Andy Weir', price: 13.99, imageUrl: 'https://placehold.co/200x300?text=Martian' },
        { title: 'Foundation', author: 'Isaac Asimov', price: 15.00, imageUrl: 'https://placehold.co/200x300?text=Foundation' },
        { title: 'Fahrenheit 451', author: 'Ray Bradbury', price: 10.00, imageUrl: 'https://placehold.co/200x300?text=Fahrenheit' }
    ]
};

async function seed() {
    try {
        console.log('Syncing database (force: true)...');
        // Force sync to drop tables and recreate with UUIDs
        await sequelize.sync({ force: true });
        console.log('Database synced.');

        console.log('Creating User Types...');
        const adminType = await UserType.create({ name: 'Admin' });
        const customerType = await UserType.create({ name: 'Customer' });
        const guestType = await UserType.create({ name: 'Guest' });
        console.log('User Types created.');

        console.log('Creating Users...');
        const passwordHash = await bcrypt.hash('password123', 10);

        await User.create({
            name: 'Admin User',
            email: 'admin@bookstore.com',
            password_hash: passwordHash,
            userTypeId: adminType.id
        });

        await User.create({
            name: 'Demo Customer',
            email: 'customer@bookstore.com',
            password_hash: passwordHash,
            userTypeId: customerType.id
        });
        console.log('Users created.');

        console.log('Seeding Books...');
        for (const [category, books] of Object.entries(categories)) {
            for (const book of books) {
                await Book.create({
                    ...book,
                    category: category,
                    description: `A fantastic book titled ${book.title}.`
                });
            }
        }
        console.log('Books seeded.');

        console.log('Seed Complete!');
    } catch (err) {
        console.error('Error seeding database:', err);
    } finally {
        await sequelize.close();
    }
}

seed();
