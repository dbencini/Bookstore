require('dotenv').config();
const { Book, Category, BookCategory, sequelize } = require('./models');
const { v4: uuidv4 } = require('uuid');

async function recovery() {
    try {
        await sequelize.authenticate();
        console.log('Connected.');

        const [defaultCat] = await Category.findOrCreate({ where: { name: 'New Books' } });
        console.log(`Targeting "New Books" category: ${defaultCat.id}`);

        // Find all books NOT in BookCategory
        // We'll do this in batches to avoid memory issues
        const BATCH_SIZE = 10000;
        let offset = 0;
        let totalLinked = 0;

        console.log('Identifying unlinked books...');

        while (true) {
            const unlinkedBooks = await sequelize.query(`
                SELECT id FROM books 
                WHERE id NOT IN (SELECT BookId FROM book_category)
                LIMIT :limit
            `, {
                replacements: { limit: BATCH_SIZE },
                type: sequelize.QueryTypes.SELECT
            });

            if (unlinkedBooks.length === 0) break;

            const mappings = unlinkedBooks.map(b => ({
                id: uuidv4(),
                BookId: b.id,
                CategoryId: defaultCat.id,
                createdAt: new Date(),
                updatedAt: new Date()
            }));

            await BookCategory.bulkCreate(mappings, { ignoreDuplicates: true });
            totalLinked += unlinkedBooks.length;

            console.log(`Linked ${totalLinked.toLocaleString()} books...`);

            // Wait slightly to not lock DB
            await new Promise(r => setTimeout(r, 100));
        }

        console.log('Recovery Complete. Clearing Homepage counts...');
        // Recalculate book_count for "New Books"
        const finalCount = await BookCategory.count({ where: { CategoryId: defaultCat.id } });
        defaultCat.book_count = finalCount;
        await defaultCat.save();

        console.log(`Final "New Books" count: ${finalCount}`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

recovery();
