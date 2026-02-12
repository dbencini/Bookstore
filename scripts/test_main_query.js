require('dotenv').config();
const { sequelize, Book, Category } = require('../models');

async function testMainQuery() {
    try {
        const categoryName = 'Bestseller';
        console.log(`Testing query for category: ${categoryName}`);

        const categoryData = await Category.findOne({ where: { name: categoryName } });
        if (!categoryData) {
            console.log('Category not found!');
            process.exit(1);
        }

        const start = Date.now();
        const books = await sequelize.query(`
            SELECT b.* FROM book_category bc
            JOIN books b ON b.id = bc.BookId
            WHERE bc.CategoryId = :categoryId AND b.isVisible = true 
            ORDER BY b.createdAt DESC LIMIT 8 OFFSET 0
        `, {
            replacements: { categoryId: categoryData.id },
            type: sequelize.QueryTypes.SELECT,
            model: Book,
            mapToModel: true
        });

        console.log(`Query completed in ${Date.now() - start}ms`);
        console.log(`Found ${books.length} books.`);
        books.forEach(b => console.log(`- ${b.title}`));

    } catch (err) {
        console.error('Query failed:', err);
    }
    process.exit(0);
}

testMainQuery();
