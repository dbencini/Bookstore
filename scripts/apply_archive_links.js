require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sequelize, Book } = require('../models');
const { Op } = require('sequelize');

/**
 * ARCHIVE.ORG LINK APPLICATION
 * Maps Cover IDs to deterministic Archive.org ZIP-sub-item URLs.
 * Tracks progress in a JSON file to survive crashes/restarts.
 */

const MAPPING_FILE = path.join(__dirname, 'isbn_to_cover_id.json');
const PROGRESS_FILE = path.join(__dirname, '../archive_links_progress.json');

async function applyArchiveLinks() {
    console.log("--- Starting Archive.org Link Application ---");

    if (!fs.existsSync(MAPPING_FILE)) {
        console.error(`ERROR: Mapping file not found: ${MAPPING_FILE}`);
        process.exit(1);
    }

    const mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
    const isbns = Object.keys(mapping);
    console.log(`Loaded mapping for ${isbns.length} ISBNs.`);

    let lastProcessedIndex = 0;
    if (fs.existsSync(PROGRESS_FILE)) {
        const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
        lastProcessedIndex = progress.lastProcessedIndex || 0;
        console.log(`Resuming from batch index: ${lastProcessedIndex}`);
    }

    const batchSize = 1000;
    let totalUpdated = 0;

    for (let i = lastProcessedIndex; i < isbns.length; i += batchSize) {
        const batchIsbns = isbns.slice(i, i + batchSize);

        await sequelize.transaction(async (t) => {
            for (const isbn of batchIsbns) {
                const coverId = mapping[isbn];
                if (!coverId) continue;

                // Open Library Cover IDs are usually up to 10 digits
                const idStr = coverId.toString().padStart(10, '0');

                // ARCHIVE.ORG DETERMINISTIC PATTERN:
                // l_covers_{first4}/{first4}_{next2}.zip/{fullid}-L.jpg
                const item = idStr.substring(0, 4);
                const zip = idStr.substring(4, 6);

                const archiveUrl = `https://archive.org/download/l_covers_${item}/l_covers_${item}_${zip}.zip/${idStr}-L.jpg`;

                // Update books with this ISBN
                // We overwrite existing URLs except for local (/uploads) versions if they exist
                await Book.update(
                    { imageUrl: archiveUrl },
                    {
                        where: {
                            isbn: isbn,
                            imageUrl: { [Op.notLike]: '/uploads/%' }
                        },
                        transaction: t
                    }
                );
                totalUpdated++;
            }
        });

        // Save progress
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
            lastProcessedIndex: i + batchSize,
            totalUpdated,
            lastUpdate: new Date().toISOString()
        }, null, 2));

        if ((i + batchSize) % 5000 === 0 || i + batchSize >= isbns.length) {
            console.log(`Progress: Applied links for ${Math.min(i + batchSize, isbns.length)}/${isbns.length} ISBNs... (Total Updates: ${totalUpdated})`);
        }
    }

    console.log(`\nCOMPLETED SUCCESSFULLLY.`);
    console.log(`Total ISBNs processed: ${isbns.length}`);

    if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
    process.exit(0);
}

applyArchiveLinks().catch(err => {
    console.error('CRITICAL ERROR:', err);
    process.exit(1);
});
