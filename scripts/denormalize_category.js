const { sequelize, Book, Subject, Category } = require('../models');

async function run() {
    try {
        console.log('--- Denormalizing Category Names into Books ---');

        // 1. Add column (handle error if exists)
        console.log('Ensuring primaryCategoryName column exists...');
        try {
            await sequelize.query("ALTER TABLE Books ADD COLUMN primaryCategoryName VARCHAR(255)");
            console.log('Column added.');
        } catch (e) {
            console.log('Column probably already exists.');
        }

        try {
            await sequelize.query("CREATE INDEX idx_books_primaryCategoryName ON Books(primaryCategoryName)");
            console.log('Index created.');
        } catch (e) {
            console.log('Index probably already exists.');
        }

        // 2. Build Category -> Subject Map
        console.log('Fetching Category -> Subject mapping...');
        const categories = await Category.findAll({
            include: [{ model: Subject }]
        });

        const subjectToCategoryMap = {};
        for (const cat of categories) {
            for (const sub of cat.Subjects) {
                if (!subjectToCategoryMap[sub.id]) {
                    subjectToCategoryMap[sub.id] = cat.name;
                }
            }
        }
        const subjectIds = Object.keys(subjectToCategoryMap);
        console.log(`Mapped ${subjectIds.length} subjects to categories.`);

        // 3. Update Books directly
        console.log('Updating Books table...');
        let totalUpdated = 0;

        for (const subId of subjectIds) {
            const catName = subjectToCategoryMap[subId];

            // Update Books that have this subjectId directly
            const [result] = await sequelize.query(
                `UPDATE Books SET primaryCategoryName = :catName WHERE subjectId = :subId AND primaryCategoryName IS NULL`,
                { replacements: { catName, subId } }
            );
            totalUpdated += result.affectedRows || 0;

            // Update Books via book_subjects table
            const [result2] = await sequelize.query(
                `UPDATE Books b 
                 JOIN book_subjects bs ON b.id = bs.BookId 
                 SET b.primaryCategoryName = :catName 
                 WHERE bs.SubjectId = :subId AND b.primaryCategoryName IS NULL`,
                { replacements: { catName, subId } }
            );
            totalUpdated += result2.affectedRows || 0;
        }

        console.log(`--- Denormalization Complete. Approx ${totalUpdated} rows updated. ---`);
        process.exit(0);
    } catch (err) {
        console.error('Denormalization Failed:', err);
        process.exit(1);
    }
}

run();
