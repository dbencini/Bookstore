require('dotenv').config();
const fs = require('fs');
const readline = require('readline');
const { Book } = require('../models');

async function extractMapping() {
    console.log("--- Starting ISBN-to-CoverID Extraction ---");
    console.log("This will stream the 59GB metadata dump to find matches for our database.");

    // 1. Get all ISBNs from our database to create a lookup filter
    // Using a Set for O(1) lookups during the stream
    const ourIsbns = new Set();
    const books = await Book.findAll({
        attributes: ['isbn'],
        raw: true
    });

    books.forEach(b => {
        if (b.isbn) {
            const clean = b.isbn.replace(/[-\s]/g, '');
            if (clean) ourIsbns.add(clean);
        }
    });

    console.log(`Loaded ${ourIsbns.size} unique ISBNs from database for filtering.`);

    const mapping = {};
    let processedLines = 0;
    let matchCount = 0;
    const dumpPath = 'C:/development/Bookstore/uploads/OpenLibraryBooks.txt';
    const outputPath = 'C:/development/Bookstore/scripts/isbn_to_cover_id.json';

    const rl = readline.createInterface({
        input: fs.createReadStream(dumpPath),
        terminal: false
    });

    rl.on('line', (line) => {
        processedLines++;

        // Open Library dump format is usually: type <tab> key <tab> version <tab> last_modified <tab> JSON
        // We look for segments that contain "isbn" and "covers"
        if (line.includes('"isbn') && line.includes('"covers"')) {
            try {
                const parts = line.split('\t');
                const jsonStr = parts[parts.length - 1];
                const data = JSON.parse(jsonStr);

                if (data.isbn_13 || data.isbn_10 || data.isbn) {
                    const covers = data.covers;
                    if (covers && covers.length > 0) {
                        const coverId = covers[0]; // Take the first cover
                        if (coverId && coverId > 0) {
                            const isbns = [
                                ...(data.isbn_13 || []),
                                ...(data.isbn_10 || []),
                                ...(data.isbn || [])
                            ];

                            for (let isbn of isbns) {
                                const cleanIsbn = isbn.replace(/[-\s]/g, '');
                                if (ourIsbns.has(cleanIsbn)) {
                                    mapping[cleanIsbn] = coverId;
                                    matchCount++;
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                // Skip malformed lines
            }
        }

        if (processedLines % 1000000 === 0) {
            console.log(`Processed ${processedLines / 1000000}M lines... Matches: ${matchCount}`);
            // Periodic save to avoid data loss if interrupted
            fs.writeFileSync(outputPath, JSON.stringify(mapping, null, 2));
        }
    });

    rl.on('close', () => {
        console.log(`\nFINISHED Extraction.`);
        console.log(`Total Lines: ${processedLines}`);
        console.log(`Total Matches Found: ${Object.keys(mapping).length}`);
        fs.writeFileSync(outputPath, JSON.stringify(mapping, null, 2));
        console.log(`Mapping saved to: ${outputPath}`);
        process.exit(0);
    });
}

extractMapping().catch(err => {
    console.error('CRITICAL ERROR:', err);
    process.exit(1);
});
