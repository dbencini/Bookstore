require('dotenv').config();
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { Book } = require('../models');
const { Op } = require('sequelize');

async function bridgeAndApply() {
    console.log("--- Starting Zero-Prompt Global Cover Bridge (Enhanced Inheritance) ---");

    try {
        // 1. Load books needing covers
        console.log("Step 1: Loading books missing high-quality images...");
        const books = await Book.findAll({
            attributes: ['id', 'isbn'],
            where: {
                [Op.or]: [
                    { imageUrl: '' },
                    { imageUrl: null },
                    { imageUrl: '/images/default-book-cover.png' },
                    { imageUrl: { [Op.like]: '%google.com%' } },
                    { imageUrl: { [Op.like]: '%amazon.com%' } }
                ]
            },
            raw: true
        });

        const ourIsbns = new Map();
        books.forEach(b => {
            if (b.isbn) {
                const clean = b.isbn.replace(/[-\s]/g, '');
                if (clean) ourIsbns.set(clean, b.id);
            }
        });
        console.log(`Found ${ourIsbns.size} target books.`);

        // 2. Load Mapping Index (EditionKey -> CoverID)
        console.log("Step 2: Loading CoverID mapping index (5M entries)...");
        const editionToCoverId = new Map();
        const mappingPath = path.join(__dirname, '../uploads/coverids.txt');
        const rlMapping = readline.createInterface({
            input: fs.createReadStream(mappingPath),
            terminal: false
        });

        for await (const line of rlMapping) {
            const parts = line.split('\t');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const cId = parts[1].trim().split(',')[0];
                if (cId) editionToCoverId.set(key, cId);
            }
        }
        console.log(`Loaded ${editionToCoverId.size} edition-to-cover mappings.`);

        // 3. Scan 59GB dump (Building Heritage)
        console.log("Step 3: Scanning 59GB metadata dump for heritage and direct matches...");
        const dumpPath = path.join(__dirname, '../uploads/OpenLibraryBooks.txt');
        const rlDump = readline.createInterface({
            input: fs.createReadStream(dumpPath),
            terminal: false
        });

        const isbnToEdition = new Map();
        const editionToWork = new Map();
        const workToCover = new Map(); // WorkKey -> CoverID
        const directEditionCovers = new Map(); // EditionKey -> CoverID (found in dump)

        let processed = 0;
        let isbnHits = 0;

        for await (const line of rlDump) {
            processed++;
            const isEdition = line.includes('/type/edition');
            const isWork = line.includes('/type/work');

            if (isEdition) {
                try {
                    const parts = line.split('\t');
                    const editionKey = parts[1].replace('/books/', '').trim();
                    const jsonStr = parts[parts.length - 1];
                    const data = JSON.parse(jsonStr);

                    // Track Work heritage
                    const workKey = data.works && data.works[0] ? data.works[0].key.replace('/works/', '').trim() : null;
                    if (workKey) editionToWork.set(editionKey, workKey);

                    // Track direct covers
                    if (data.covers && data.covers[0]) {
                        directEditionCovers.set(editionKey, data.covers[0]);
                        if (workKey) workToCover.set(workKey, data.covers[0]);
                    }

                    // Check for our ISBNs
                    if (line.includes('"isbn')) {
                        const isbns = [...(data.isbn_13 || []), ...(data.isbn_10 || []), ...(data.isbn || [])];
                        for (let isbn of isbns) {
                            if (typeof isbn !== 'string') continue;
                            const clean = isbn.replace(/[-\s]/g, '');
                            if (ourIsbns.has(clean)) {
                                isbnHits++;
                                isbnToEdition.set(clean, editionKey);
                            }
                        }
                    }
                } catch (e) { }
            } else if (isWork) {
                try {
                    const parts = line.split('\t');
                    const workKey = parts[1].replace('/works/', '').trim();
                    const jsonStr = parts[parts.length - 1];
                    const data = JSON.parse(jsonStr);
                    if (data.covers && data.covers[0]) {
                        workToCover.set(workKey, data.covers[0]);
                    }
                } catch (e) { }
            }

            if (processed % 5000000 === 0) {
                console.log(`Processed ${processed / 1000000}M lines... ISBN Hits: ${isbnToEdition.size}`);
            }
        }

        // 4. Bridge Mappings
        console.log("Step 4: Bridging tiered mappings...");
        const finalResults = new Map(); // isbn -> coverId

        for (const [isbn, editionKey] of isbnToEdition) {
            // Priority 1: Direct cover from dump record
            let coverId = directEditionCovers.get(editionKey);

            // Priority 2: Mapping from coverids.txt index
            if (!coverId) coverId = editionToCoverId.get(editionKey);

            // Priority 3: Work-level inheritance
            if (!coverId) {
                const workKey = editionToWork.get(editionKey);
                if (workKey) {
                    coverId = workToCover.get(workKey);
                    // Also check if any OTHER edition in our index has a cover for this work
                    // (This is implicitly covered by Step 3 if ANY edition was scanned)
                }
            }

            if (coverId) finalResults.set(isbn, coverId);
        }

        console.log(`Bridge complete: Found ${finalResults.size} covers for ${isbnToEdition.size} mapped ISBNs.`);

        // 5. Apply
        console.log("Step 5: Updating database...");
        let applied = 0;
        const entries = Array.from(finalResults.entries());
        const batchSize = 1000;

        for (let i = 0; i < entries.length; i += batchSize) {
            const batch = entries.slice(i, i + batchSize);
            await Promise.all(batch.map(async ([isbn, coverId]) => {
                const bookId = ourIsbns.get(isbn);
                const cId = coverId.toString().split(',')[0].trim();
                const prefix = cId.padStart(10, '0').substring(0, 4);
                const url = `https://archive.org/download/l_covers_${prefix}/l_covers_${prefix}_00.zip/${cId.padStart(10, '0')}-L.jpg`;
                await Book.update({ imageUrl: url }, { where: { id: bookId } });
                applied++;
            }));
            if (applied % 5000 === 0) console.log(`Applied ${applied} updates...`);
        }

        console.log(`\nSUCCESS: Applied ${applied} high-quality Archive.org links.`);
        process.exit(0);

    } catch (e) {
        console.error("FATAL ERROR:", e);
        process.exit(1);
    }
}

bridgeAndApply();
