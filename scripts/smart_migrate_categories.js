require('dotenv').config();
const { Book, Category, Subject, BookCategory, sequelize } = require('../models');
const { Op } = require('sequelize');

const CATEGORY_TRIGGERS = {
    "Art & Architecture": "art, architecture, painting, sculpture, design",
    "Business & Finance": "business, finance, accounting, economy, investing",
    "Children & Young Adult": "child, juvenile, young adult, youth, teenager",
    "Cooking & Food": "cooking, cookbook, recipe, food, diet",
    "Crafts & Hobbies": "craft, hobby, gardening, collecting, sewing",
    "Fiction & Literature": "fiction, novel, poetry, literature, drama",
    "Health & Medical": "health, medical, fitness, medicine, nursing",
    "History & Biography": "history, biography, memoir, genealogy, historical",
    "Reference & Study": "reference, dictionary, encyclopedia, study, textbook",
    "Religion & Philosophy": "religion, philosophy, theology, bible, spiritual",
    "Science & Technology": "science, technology, physics, biology, computer",
    "Self-Help & Personal Development": "self-help, development, motivation, success, psychology",
    "Social Sciences": "social, sociology, political, law, anthropology",
    "Travel & Geography": "travel, geography, guide, atlas, touring"
};

const IGNORE_WORDS = ['general', 'miscellaneous', 'books', 'various'];

async function run() {
    console.log('--- Starting Smart Categorization Migration ---');

    // 1. Sync Category Triggers
    console.log('Syncing trigger words to Category table...');
    for (const [name, triggers] of Object.entries(CATEGORY_TRIGGERS)) {
        await Category.update({ subject_triggers: triggers }, { where: { name } });
    }

    // 2. Fetch all categories with triggers
    const categories = await Category.findAll();
    const triggerMap = categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        triggers: (cat.subject_triggers || "").split(',').map(t => t.trim().toLowerCase()).filter(t => t !== "")
    }));

    // 3. Pre-load all Subjects into memory for performance
    console.log('Loading all subjects into memory...');
    const allSubjects = await Subject.findAll({ attributes: ['id', 'name'] });
    const subjectMap = {};
    for (const sub of allSubjects) {
        subjectMap[sub.id] = sub.name.toLowerCase();
    }
    console.log(`Loaded ${allSubjects.length} subjects.`);

    // 4. Process Books in Batches
    const BATCH_SIZE = 5000;
    let totalProcessed = 0;
    let lastId = null;

    // RESUMABILITY: Check for a resume file
    const fs = require('fs');
    const path = require('path');
    const RESUME_FILE = path.join(__dirname, 'category_migration_index.json');
    if (fs.existsSync(RESUME_FILE)) {
        const resumeData = JSON.parse(fs.readFileSync(RESUME_FILE));
        lastId = resumeData.lastId;
        totalProcessed = resumeData.totalProcessed;
        console.log(`Resuming from ID: ${lastId} (Processed: ${totalProcessed})`);
    } else {
        console.log('Starting fresh. Clearing book_category table...');
        await BookCategory.truncate();
    }

    while (true) {
        const query = {
            where: {},
            limit: BATCH_SIZE,
            order: [['id', 'ASC']],
            attributes: ['id', 'title', 'description', 'subjectIdsJson']
        };

        if (lastId) {
            query.where.id = { [Op.gt]: lastId };
        }

        const books = await Book.findAll(query);
        if (books.length === 0) break;

        const bulkInserts = [];

        for (const book of books) {
            // Get subject names from cache
            const subjectNames = (book.subjectIdsJson || [])
                .map(id => subjectMap[id])
                .filter(name => !!name);

            // Also check title and description
            const textToSearch = `${book.title} ${book.description || ''} ${subjectNames.join(' ')}`.toLowerCase();

            const matchedCategoryIds = [];
            for (const cat of triggerMap) {
                if (cat.name === "General & Miscellaneous") continue;

                // Check triggers
                const isMatch = cat.triggers.some(trigger => {
                    if (IGNORE_WORDS.includes(trigger)) return false;
                    return textToSearch.includes(trigger);
                });

                if (isMatch) {
                    matchedCategoryIds.push(cat.id);
                    if (matchedCategoryIds.length >= 5) break; // User requested limit 5
                }
            }

            // If no match, put in Misc
            if (matchedCategoryIds.length === 0) {
                const miscCat = triggerMap.find(c => c.name === "General & Miscellaneous");
                if (miscCat) matchedCategoryIds.push(miscCat.id);
            }

            for (const catId of matchedCategoryIds) {
                bulkInserts.push({
                    id: require('crypto').randomUUID(),
                    BookId: book.id,
                    CategoryId: catId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }

            lastId = book.id;
        }

        if (bulkInserts.length > 0) {
            await BookCategory.bulkCreate(bulkInserts, { ignoreDuplicates: true });
        }

        totalProcessed += books.length;
        console.log(`Processed ${totalProcessed} books...`);

        // Save progress for resumability
        fs.writeFileSync(RESUME_FILE, JSON.stringify({ lastId, totalProcessed }));

        if (books.length < BATCH_SIZE) break;
    }

    console.log('--- Migration Complete ---');
    if (fs.existsSync(RESUME_FILE)) fs.unlinkSync(RESUME_FILE);
    process.exit(0);
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
