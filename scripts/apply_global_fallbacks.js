require('dotenv').config();
const { Book } = require('../models');
const { Op } = require('sequelize');

async function applyGlobalFallbacks() {
    console.log("--- Starting Zero-Prompt Global Tiered Fallback (Google & Amazon) ---");

    try {
        // 1. Identify remaining books
        console.log("Step 1: Identifying records requiring fallback coverage...");
        const targetBooks = await Book.findAll({
            attributes: ['id', 'isbn'],
            where: {
                [Op.or]: [
                    { imageUrl: '' },
                    { imageUrl: null },
                    { imageUrl: { [Op.notLike]: '%archive.org%' } }
                ],
                [Op.and]: [
                    { imageUrl: { [Op.notLike]: '%google.com%' } },
                    { imageUrl: { [Op.notLike]: '%amazon.com%' } }
                ]
            },
            raw: true
        });

        console.log(`Found ${targetBooks.length} records needing fallback.`);
        if (targetBooks.length === 0) {
            console.log("Coverage complete. No action required.");
            process.exit(0);
        }

        // 2. Batch Update
        const batchSize = 1000;
        let applied = 0;

        for (let i = 0; i < targetBooks.length; i += batchSize) {
            const batch = targetBooks.slice(i, i + batchSize);

            await Promise.all(batch.map(async (book) => {
                if (!book.isbn) return;

                const clean = book.isbn.replace(/[-\s]/g, '');
                if (!clean) return;

                // Priority A: Google Books ISBN Pattern (Dynamic and safe)
                // Pattern: https://books.google.com/books/content?vid=ISBN:{ISBN}&printsec=frontcover&img=1&zoom=1
                const googleUrl = `https://books.google.com/books/content?vid=ISBN:${clean}&printsec=frontcover&img=1&zoom=1`;

                // Note: We don't perform a HEAD check here to stay "Non-Rate-Limited" and "Zero-Prompt".
                // We use the deterministic pattern. If Google doesn't have it, it returns a 1x1 or default.
                // However, many of these 3.5M will yield a valid cover.

                await Book.update({ imageUrl: googleUrl }, { where: { id: book.id } });
                applied++;
            }));

            if (applied % 5000 === 0) {
                console.log(`Applied fallback to ${applied} / ${targetBooks.length} records...`);
            }
        }

        console.log(`\nSUCCESS: Applied global fallback patterns to ${applied} records.`);
        process.exit(0);

    } catch (e) {
        console.error("FATAL ERROR:", e);
        process.exit(1);
    }
}

applyGlobalFallbacks();
