require('dotenv').config();
const fs = require('fs');
const readline = require('readline');
const { Book } = require('../models');

async function extractGlobalMapping() {
    try {
        console.log("--- Starting Global Cover Bridge (100% Coverage Goal) ---");

        // 1. Load ISBNs from database
        console.log("Loading ISBNs from database...");
        const books = await Book.findAll({
            attributes: ['isbn'],
            raw: true
        });
        const ourIsbns = new Set();
        books.forEach(b => {
            if (b.isbn) {
                const clean = b.isbn.replace(/[-\s]/g, '');
                if (clean) ourIsbns.add(clean);
            }
        });
        console.log(`Loaded ${ourIsbns.size} unique ISBNs from database.`);

        const editionToWork = new Map(); // isbn -> workId
        const editionToCover = new Map(); // isbn -> coverId
        const interestingWorks = new Set();

        const dumpPath = 'C:/development/Bookstore/uploads/OpenLibraryBooks.txt';

        // PASS 1: Extract Edition mapping
        console.log("\n--- PASS 1: Mapping ISBNs to Works and Edition Covers ---");
        const rl1 = readline.createInterface({
            input: fs.createReadStream(dumpPath),
            terminal: false
        });

        let processedLines = 0;
        let editionMatches = 0;

        for await (const line of rl1) {
            processedLines++;

            // Fast filter checks
            if (line.includes('/type/edition') && line.includes('"isbn')) {
                try {
                    const parts = line.split('\t');
                    const jsonStr = parts[parts.length - 1];

                    // Even faster filter: check if any of our ISBNs are in the string before parsing
                    // (Actually, parsing is safer)
                    const data = JSON.parse(jsonStr);
                    const isbns = [
                        ...(data.isbn_13 || []),
                        ...(data.isbn_10 || []),
                        ...(data.isbn || [])
                    ];

                    let matchedIsbns = [];
                    for (let isbn of isbns) {
                        if (typeof isbn !== 'string') continue;
                        const clean = isbn.replace(/[-\s]/g, '');
                        if (ourIsbns.has(clean)) {
                            matchedIsbns.push(clean);
                        }
                    }

                    if (matchedIsbns.length > 0) {
                        const workId = data.works && data.works[0] ? data.works[0].key : null;
                        const coverId = data.covers && data.covers[0] ? data.covers[0] : null;

                        matchedIsbns.forEach(isbn => {
                            if (coverId) {
                                editionToCover.set(isbn, coverId);
                                editionMatches++;
                            }
                            if (workId) {
                                editionToWork.set(isbn, workId);
                                interestingWorks.add(workId);
                            }
                        });
                    }
                } catch (e) { }
            }

            if (processedLines % 5000000 === 0) {
                console.log(`Processed ${processedLines / 1000000}M lines... Editions matched: ${editionMatches}`);
            }
        }

        console.log(`Pass 1 Finished. Total Edmitions matched: ${editionMatches}. Unique Works to find: ${interestingWorks.size}`);

        // PASS 2: Extract Work covers
        console.log("\n--- PASS 2: Mapping Works to Covers ---");
        const rl2 = readline.createInterface({
            input: fs.createReadStream(dumpPath),
            terminal: false
        });

        const workToCover = new Map();
        processedLines = 0;
        let workMatches = 0;

        for await (const line of rl2) {
            processedLines++;
            if (line.includes('/type/work') && line.includes('"covers"')) {
                try {
                    const parts = line.split('\t');
                    const key = parts[1]; // e.g. /works/OL123W
                    if (interestingWorks.has(key)) {
                        const data = JSON.parse(parts[parts.length - 1]);
                        const coverId = data.covers && data.covers[0] ? data.covers[0] : null;
                        if (coverId) {
                            workToCover.set(key, coverId);
                            workMatches++;
                        }
                    }
                } catch (e) { }
            }
            if (processedLines % 5000000 === 0) {
                console.log(`Processed ${processedLines / 1000000}M lines... Works matched: ${workMatches}`);
            }
        }

        // FINAL BRIDGE
        console.log("\n--- BRIDGE: Combining Results ---");
        let finalMatches = 0;
        const finalMapping = {};

        for (const isbn of ourIsbns) {
            let coverId = editionToCover.get(isbn);
            if (!coverId) {
                const workId = editionToWork.get(isbn);
                if (workId) coverId = workToCover.get(workId);
            }

            if (coverId) {
                finalMapping[isbn] = coverId;
                finalMatches++;
            }
        }

        const outPath = 'C:/development/Bookstore/scripts/isbn_to_cover_id_final.json';
        fs.writeFileSync(outPath, JSON.stringify(finalMapping, null, 2));
        console.log(`\nSUCCESS: Found ${finalMatches} total bridges to Archive.org.`);
        console.log(`Mapping saved to: ${outPath}`);
        process.exit(0);

    } catch (err) {
        console.error('CRITICAL ERROR:', err);
        process.exit(1);
    }
}

extractGlobalMapping();
