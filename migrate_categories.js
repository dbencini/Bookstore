const { sequelize, Book, Category } = require('./models');

async function migrate() {
    try {
        // 1. Sync Category Table
        await Category.sync();
        const { DataTypes } = require('sequelize');
        const queryInterface = sequelize.getQueryInterface();

        // 2. Add categoryId column if not exists (using manual query for SQLite safety)
        try {
            await sequelize.query("ALTER TABLE Books ADD COLUMN categoryId CHAR(36)");
            console.log("Added categoryId column.");
        } catch (e) {
            console.log("categoryId column might already exist.");
        }

        // 3. Migrate Data
        const books = await Book.findAll();
        const distinctCategories = [...new Set(books.map(b => b.category))];

        console.log(`Found ${distinctCategories.length} distinct categories.`);

        for (const catName of distinctCategories) {
            if (!catName) continue;
            const [category] = await Category.findOrCreate({ where: { name: catName } });

            // Bulk update books with this string category to the new ID
            await Book.update({ categoryId: category.id }, { where: { category: catName } });
            console.log(`Migrated '${catName}' to ${category.id}`);
        }

        console.log("Migration Complete.");

    } catch (err) {
        console.error("Migration Failed:", err);
    } finally {
        await sequelize.close();
    }
}

migrate();
