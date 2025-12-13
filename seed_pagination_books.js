const { sequelize, Book } = require('./models');

async function seedPaginationBooks() {
    try {
        console.log('Seeding 20 pagination books...');
        for (let i = 1; i <= 20; i++) {
            await Book.create({
                title: `Pagination Test Book ${i}`,
                author: `Author ${i}`,
                price: 10 + i,
                category: 'Fiction',
                description: `Description for pagination test book ${i}`,
                imageUrl: 'https://via.placeholder.com/150'
            });
        }
        console.log('Done.');
    } catch (err) {
        console.error('Error seeding pagination books:', err);
    } finally {
        await sequelize.close();
    }
}

seedPaginationBooks();
