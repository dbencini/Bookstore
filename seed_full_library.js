const { sequelize, Book } = require('./models');

const categories = {
    'Bestsellers': [
        { title: 'The Thursday Murder Club', author: 'Richard Osman', price: 10.00 },
        { title: 'Atomic Habits', author: 'James Clear', price: 16.00 },
        { title: 'It Ends with Us', author: 'Colleen Hoover', price: 12.99 },
        { title: 'Lessons in Chemistry', author: 'Bonnie Garmus', price: 14.99 },
        { title: 'The Seven Husbands of Evelyn Hugo', author: 'Taylor Jenkins Reid', price: 11.99 },
        { title: 'Verity', author: 'Colleen Hoover', price: 13.99 }
    ],
    'Fiction': [
        { title: 'The Catcher in the Rye', author: 'J.D. Salinger', price: 9.99 },
        { title: 'The Kite Runner', author: 'Khaled Hosseini', price: 12.50 },
        { title: 'Life of Pi', author: 'Yann Martel', price: 10.99 },
        { title: 'The Alchemist', author: 'Paulo Coelho', price: 11.00 },
        { title: 'The Midnight Library', author: 'Matt Haig', price: 13.50 },
        { title: 'Where the Crawdads Sing', author: 'Delia Owens', price: 14.00 }
    ],
    'Non-Fiction': [
        { title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari', price: 15.99 },
        { title: 'Educated', author: 'Tara Westover', price: 14.99 },
        { title: 'Becoming', author: 'Michelle Obama', price: 18.00 },
        { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', price: 14.50 },
        { title: 'Quiet', author: 'Susan Cain', price: 13.00 },
        { title: 'Into the Wild', author: 'Jon Krakauer', price: 12.00 }
    ],
    'Classics': [
        { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', price: 10.00 },
        { title: 'To Kill a Mockingbird', author: 'Harper Lee', price: 12.00 },
        { title: 'Pride and Prejudice', author: 'Jane Austen', price: 8.99 },
        { title: '1984', author: 'George Orwell', price: 9.99 }, // Also sci-fi, but keeping simple
        { title: 'Jane Eyre', author: 'Charlotte Bronte', price: 9.50 },
        { title: 'Wuthering Heights', author: 'Emily Bronte', price: 9.50 }
    ],
    'Children\'s': [
        { title: 'The Very Hungry Caterpillar', author: 'Eric Carle', price: 6.99 },
        { title: 'Harry Potter and the Sorcerer\'s Stone', author: 'J.K. Rowling', price: 12.99 },
        { title: 'Charlotte\'s Web', author: 'E.B. White', price: 8.99 },
        { title: 'Green Eggs and Ham', author: 'Dr. Seuss', price: 7.99 },
        { title: 'Matilda', author: 'Roald Dahl', price: 9.99 },
        { title: 'The Lion, the Witch and the Wardrobe', author: 'C.S. Lewis', price: 10.99 }
    ],
    'Science Fiction': [
        { title: 'Dune', author: 'Frank Herbert', price: 18.99 },
        { title: 'Neuromancer', author: 'William Gibson', price: 14.00 },
        { title: 'Ender\'s Game', author: 'Orson Scott Card', price: 11.99 },
        { title: 'The Martian', author: 'Andy Weir', price: 13.99 },
        { title: 'Foundation', author: 'Isaac Asimov', price: 15.00 },
        { title: 'Fahrenheit 451', author: 'Ray Bradbury', price: 10.00 }
    ]
};

async function seedFullLibrary() {
    try {
        await sequelize.sync({ alter: true });
        for (const [category, books] of Object.entries(categories)) {
            console.log(`Seeding ${category}...`);
            for (const book of books) {
                await Book.findOrCreate({
                    where: { title: book.title },
                    defaults: {
                        ...book,
                        category: category,
                        description: `A generic description for ${book.title}.`
                    }
                });
            }
        }
        console.log('Library expansion complete!');
    } catch (error) {
        console.error('Error seeding library:', error);
    } finally {
        await sequelize.close();
    }
}

seedFullLibrary();
