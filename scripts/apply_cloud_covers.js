require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sequelize, Book } = require('../models');
const { Op } = require('sequelize');

/**
 * RESUMABLE GLOBAL IMAGE UPDATE (V2 - High Resolution)
 * Uses Google Books direct zoom=3 high-res pattern.
 * Fallback to Amazon ISBN-10 pattern if needed.
 */

const PROGRESS_FILE = path.join(__dirname, '../cloud_covers_progress_v2.json');

async function applyCloudCovers() {
    console.log("--- Starting Resumable Global HIGH-RES Cover Update ---");

    let lastProcessedId = 0;
    if (fs.existsSync(PROGRESS_FILE)) {
        const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
        lastProcessedId = progress.lastProcessedId || 0;
        console.log(`Resuming from Book ID: ${lastProcessedId}`);
    }

    const batchSize = 1000;
    let totalUpdated = 0;
    let totalProcessed = 0;
    let hasMore = true;

    while (hasMore) {
        const batch = await Book.findAll({
            where: {
                id: { [Op.gt]: lastProcessedId },
                isbn: { [Op.ne]: '' },
                [Op.or]: [
                    { imageUrl: '' },
                    { imageUrl: null },
                    { imageUrl: '/images/default-book-cover.png' },
                    { imageUrl: { [Op.like]: '%openlibrary.org/b/isbn/%' } },
                    { imageUrl: { [Op.like]: '%amazon.com/images/P/%' } } // Update previous 1-pixel attempts
                ]
            },
            attributes: ['id', 'isbn', 'imageUrl'],
            order: [['id', 'ASC']],
            limit: batchSize
        });

        if (batch.length === 0) {
            const remainingCount = await Book.count({
                where: { id: { [Op.gt]: lastProcessedId } }
            });
            if (remainingCount === 0) {
                hasMore = false;
                break;
            } else {
                const nextBook = await Book.findOne({
                    where: { id: { [Op.gt]: lastProcessedId } },
                    attributes: ['id'],
                    order: [['id', 'ASC']]
                });
                lastProcessedId = nextBook.id;
                continue;
            }
        }

        await sequelize.transaction(async (t) => {
            for (const book of batch) {
                const isbn = book.isbn.replace(/[-\s]/g, '');

                // PRIMARY: Google Books Zoom=3 (High Quality)
                const newUrl = `https://books.google.com/books/content?vid=ISBN${isbn}&printsec=frontcover&img=1&zoom=3`;

                if (book.imageUrl !== newUrl) {
                    await Book.update(
                        { imageUrl: newUrl },
                        { where: { id: book.id }, transaction: t }
                    );
                    totalUpdated++;
                }
                lastProcessedId = book.id;
                totalProcessed++;
            }
        });

        fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
            lastProcessedId,
            totalUpdated,
            totalProcessed,
            lastUpdate: new Date().toISOString()
        }, null, 2));

        if (totalProcessed % 5000 === 0) {
            console.log(`Progress: Checked ${totalProcessed} records... Last ID: ${lastProcessedId} (Updated: ${totalUpdated})`);
        }
    }

    console.log(`\nCOMPLETED SUCCESSFULLLY.`);
    console.log(`Total books updated to HIGH-RES Cloud links: ${totalUpdated}`);
    if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
    process.exit(0);
}

applyCloudCovers().catch(err => {
    console.error('CRITICAL ERROR:', err);
    process.exit(1);
});
