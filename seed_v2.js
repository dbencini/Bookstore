const { sequelize, User, UserType, Book, Category } = require('./models');
const bcrypt = require('bcrypt');

const categoriesData = {
    'Christmas': [
        { title: 'A Christmas Carol', author: 'Charles Dickens', price: 8.99, imageUrl: 'https://placehold.co/200x300?text=Christmas+Carol' },
        { title: 'How the Grinch Stole Christmas!', author: 'Dr. Seuss', price: 12.99, imageUrl: 'https://placehold.co/200x300?text=Grinch' }
    ],
    'Bestsellers': [
        { title: 'The Thursday Murder Club', author: 'Richard Osman', price: 10.00, imageUrl: 'https://placehold.co/200x300?text=Thursday+Club' },
        { title: 'Atomic Habits', author: 'James Clear', price: 16.00, imageUrl: 'https://placehold.co/200x300?text=Atomic+Habits' },
        { title: 'It Ends with Us', author: 'Colleen Hoover', price: 12.99, imageUrl: 'https://placehold.co/200x300?text=Ends+With+Us' },
        { title: 'Lessons in Chemistry', author: 'Bonnie Garmus', price: 14.99, imageUrl: 'https://placehold.co/200x300?text=Lessons+Chemistry' }
    ],
    'New Books': [
        { title: 'The Exchange', author: 'John Grisham', price: 18.00, imageUrl: 'https://placehold.co/200x300?text=Exchange' },
        { title: 'Holly', author: 'Stephen King', price: 19.99, imageUrl: 'https://placehold.co/200x300?text=Holly' }
    ],
    'Coming Soon': [
        { title: 'Upcoming Hit', author: 'Famous Author', price: 20.00, imageUrl: 'https://placehold.co/200x300?text=Coming+Soon' }
    ],
    'Signed and Special Editions': [
        { title: 'Fourth Wing (Signed)', author: 'Rebecca Yarros', price: 49.99, imageUrl: 'https://placehold.co/200x300?text=Fourth+Wing' }
    ],
    'Non Fiction': [
        { title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari', price: 15.99, imageUrl: 'https://placehold.co/200x300?text=Sapiens' },
        { title: 'Educated', author: 'Tara Westover', price: 14.99, imageUrl: 'https://placehold.co/200x300?text=Educated' },
        { title: 'Becoming', author: 'Michelle Obama', price: 18.00, imageUrl: 'https://placehold.co/200x300?text=Becoming' }
    ],
    'Children': [
        { title: 'The Very Hungry Caterpillar', author: 'Eric Carle', price: 6.99, imageUrl: 'https://placehold.co/200x300?text=Caterpillar' },
        { title: 'Harry Potter and the Sorcerer\'s Stone', author: 'J.K. Rowling', price: 12.99, imageUrl: 'https://placehold.co/200x300?text=Harry+Potter' },
        { title: 'Matilda', author: 'Roald Dahl', price: 9.99, imageUrl: 'https://placehold.co/200x300?text=Matilda' },
        { title: 'The Lion, the Witch and the Wardrobe', author: 'C.S. Lewis', price: 10.99, imageUrl: 'https://placehold.co/200x300?text=Narnia' }
    ],
    'Teen and YA': [
        { title: 'The Hunger Games', author: 'Suzanne Collins', price: 11.99, imageUrl: 'https://placehold.co/200x300?text=Hunger+Games' },
        { title: 'Twilight', author: 'Stephenie Meyer', price: 10.99, imageUrl: 'https://placehold.co/200x300?text=Twilight' },
        { title: 'The Fault in Our Stars', author: 'John Green', price: 9.99, imageUrl: 'https://placehold.co/200x300?text=Fault+In+Stars' }
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

        console.log('Seeding Categories and Books...');
        for (const [categoryName, books] of Object.entries(categoriesData)) {
            // Create Category
            const category = await Category.create({ name: categoryName });

            for (const bookData of books) {
                await Book.create({
                    ...bookData,
                    category: categoryName, // Keep simple string for legacy/display compatibility
                    categoryId: category.id, // Link to actual Category model
                    description: `A fantastic book titled ${bookData.title}.`
                });
            }
        }
        console.log('Categories and Books seeded.');

        console.log('Seed Complete!');
    } catch (err) {
        console.error('Error seeding database:', err);
    } finally {
        await sequelize.close();
    }
}

seed();
