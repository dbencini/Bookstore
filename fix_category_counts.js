require('dotenv').config();
const { Category, BookCategory, sequelize } = require('./models');

async function fixCounts() {
    try {
        await sequelize.authenticate();
        console.log('Connected.');

        const categories = await Category.findAll();
        console.log(`Updating counts for ${categories.length} categories...`);

        for (const cat of categories) {
            const count = await BookCategory.count({ where: { CategoryId: cat.id } });
            cat.book_count = count;
            await cat.save();
            console.log(`${cat.name}: ${count}`);
        }

        console.log('Done.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fixCounts();
