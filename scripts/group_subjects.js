const { sequelize, Subject, Category, CategorySubject } = require('../models');
const { Op } = require('sequelize');

const TAXONOMY = [
    { name: 'Fiction & Literature', regex: /fiction|poetry|drama|literature|novel|classic|shakespeare|story/i },
    { name: 'History & Biography', regex: /history|biograph|memoir|century|genealog|historical|archive|ancient|medieval/i },
    { name: 'Science & Technology', regex: /science|physics|chemistry|biology|mathematics|engineering|computer|technology|space|robot|digital|software/i },
    { name: 'Health & Medical', regex: /medicin|medical|health|fitness|psychology|psychiatry|neuroscience|nurse|disease|clinical|anatomy/i },
    { name: 'Social Sciences', regex: /sociology|politic|government|law|justice|education|anthropology|economics|society|culture|communication/i },
    { name: 'Art & Architecture', regex: /art|music|architecture|theater|film|photography|design|painting|sculpture|aesthetic/i },
    { name: 'Religion & Philosophy', regex: /religion|theology|bible|philosophy|spiritual|ethics|occult|buddhism|christian|islam|hindu|judaism/i },
    { name: 'Business & Finance', regex: /business|management|finance|marketing|accounting|commerce|industry|entrepreneur|investment/i },
    { name: 'Travel & Geography', regex: /travel|geography|guidebook|regional|explorer|atlas|voyage|tourism/i },
    { name: 'Children & Young Adult', regex: /juvenile|children|youth|teenager|picture book|ya |adolescent/i },
    { name: 'Cooking & Food', regex: /cooking|food|recipe|wine|nutrition|baking|culinary|chef|restaurant/i },
    { name: 'Crafts & Hobbies', regex: /hobby|craft|gardener|pet|game|puzzle|sport|recreation|diy|knitting|sewing/i },
    { name: 'Reference & Study', regex: /reference|dictionary|encyclopedia|language|linguistics|bibliography|library|study guide|grammar/i },
    { name: 'Self-Help & Personal Development', regex: /self-help|parent|relationship|marriage|inspirational|motivation|therapy|well-being/i }
];

const FALLBACK_CATEGORY = 'General & Miscellaneous';

async function groupSubjects() {
    console.log('\n--- STARTING SUBJECT CATEGORIZATION ---');

    try {
        await sequelize.authenticate();
        console.log('[1/4] Connected to database.');

        // 1. Ensure Categories exist
        console.log('[2/4] Seeding high-level categories...');
        const categoryMap = {};
        for (const tax of TAXONOMY) {
            const [cat] = await Category.findOrCreate({ where: { name: tax.name } });
            categoryMap[tax.name] = cat.id;
        }
        const [fallbackCat] = await Category.findOrCreate({ where: { name: FALLBACK_CATEGORY } });
        categoryMap[FALLBACK_CATEGORY] = fallbackCat.id;

        // 2. Count Subjects
        const totalSubjects = await Subject.count();
        console.log(`[3/4] Found ${totalSubjects.toLocaleString()} subjects to categorize.`);

        // 3. Process in Batches
        const BATCH_SIZE = 5000;
        let processedCount = 0;
        let linkCount = 0;
        let lastId = null;

        console.log('[4/4] Categorizing...');

        while (true) {
            const subjects = await Subject.findAll({
                where: lastId ? { id: { [Op.gt]: lastId } } : {},
                limit: BATCH_SIZE,
                order: [['id', 'ASC']],
                raw: true
            });

            if (subjects.length === 0) break;

            const links = [];
            for (const sub of subjects) {
                let matched = false;
                for (const tax of TAXONOMY) {
                    if (tax.regex.test(sub.name)) {
                        links.push({
                            CategoryId: categoryMap[tax.name],
                            SubjectId: sub.id
                        });
                        matched = true;
                    }
                }

                if (!matched) {
                    links.push({
                        CategoryId: categoryMap[FALLBACK_CATEGORY],
                        SubjectId: sub.id
                    });
                }
                lastId = sub.id;
            }

            if (links.length > 0) {
                await CategorySubject.bulkCreate(links, { ignoreDuplicates: true });
                linkCount += links.length;
            }

            processedCount += subjects.length;
            if (processedCount % 10000 === 0 || processedCount === totalSubjects) {
                console.log(`    Progress: ${processedCount.toLocaleString()} / ${totalSubjects.toLocaleString()} subjects categorized. (${linkCount.toLocaleString()} links created)`);
            }
        }

        console.log('\n--- CATEGORIZATION COMPLETE ---');
        console.log(`Total Subjects: ${totalSubjects.toLocaleString()}`);
        console.log(`Total Category links: ${linkCount.toLocaleString()}`);
        process.exit(0);
    } catch (err) {
        console.error('\n[FATAL] Categorization failed:', err);
        process.exit(1);
    }
}

groupSubjects();
