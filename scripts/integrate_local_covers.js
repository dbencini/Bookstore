require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sequelize, Book } = require('../models');
const { Op } = require('sequelize');

async function integrateCovers() {
    const coversDir = path.join(__dirname, '../uploads/covers');
    if (!fs.existsSync(coversDir)) {
        console.error(`ERROR: Directory not found: ${coversDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(coversDir).filter(f => f.endsWith('.jpg'));
    console.log(`Found ${files.length} local cover files.`);

    // Map: Normalized ID String -> Actual Filename
    // Example: "14000000" -> "0014000000-L.jpg"
    const fileMapping = new Map();
    files.forEach(file => {
        const idMatch = file.match(/^0*(\d+)/);
        if (idMatch) {
            const id = idMatch[1];
            fileMapping.set(id, file);
        }
    });

    console.log(`Mapping extracted for ${fileMapping.size} unique Cover IDs.`);

    let updatedCount = 0;

    // FETCH ALL MATCHING URLS IN ONE GO (High Performance)
    const books = await Book.findAll({
        where: {
            imageUrl: {
                [Op.like]: '%openlibrary.org/b/id/%'
            }
        },
        attributes: ['id', 'imageUrl']
    });

    console.log(`Scanning ${books.length} potential database matches...`);

    const batchSize = 1000;
    for (let i = 0; i < books.length; i += batchSize) {
        const batch = books.slice(i, i + batchSize);

        await sequelize.transaction(async (t) => {
            for (const book of batch) {
                // Extract the ID from the URL: .../b/id/14853082-L.jpg -> 14853082
                const match = book.imageUrl.match(/\/b\/id\/(\d+)/);
                if (match) {
                    const id = match[1];
                    const fileName = fileMapping.get(id);
                    if (fileName) {
                        const localPath = `/uploads/covers/${fileName}`;
                        if (book.imageUrl !== localPath) {
                            await Book.update(
                                { imageUrl: localPath },
                                { where: { id: book.id }, transaction: t }
                            );
                            updatedCount++;
                        }
                    }
                }
            }
        });

        console.log(`Progress: Checked ${Math.min(i + batchSize, books.length)}/${books.length} candidates... (Total Updated: ${updatedCount})`);
    }

    console.log(`FINISHED. Total books updated to local paths: ${updatedCount}`);
    process.exit(0);
}

integrateCovers().catch(err => {
    console.error('CRITICAL ERROR:', err);
    process.exit(1);
});
