require('dotenv').config();
const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function extractMapping() {
    const dumpPath = 'uploads/OpenLibraryBooks.txt';
    const coversDir = 'uploads/covers';
    const outputPath = 'scripts/isbn_to_cover_id.json';

    if (!fs.existsSync(dumpPath)) {
        console.error("ERROR: OpenLibraryBooks.txt not found.");
        process.exit(1);
    }

    // 1. Get our local IDs
    const files = fs.readdirSync(coversDir).filter(f => f.endsWith('.jpg'));
    const targetIds = new Set();
    files.forEach(file => {
        const idMatch = file.match(/^0*(\d+)/);
        if (idMatch) targetIds.add(idMatch[1]);
    });
    console.log(`Searching for mappings for ${targetIds.size} Cover IDs...`);

    const mapping = {};
    let lineCount = 0;
    let matchCount = 0;

    const fileStream = fs.createReadStream(dumpPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        lineCount++;
        if (lineCount % 1000000 === 0) {
            console.log(`Processed ${lineCount / 1000000}M lines... Matches: ${matchCount}`);
        }

        const parts = line.split('\t');
        if (parts.length < 5) continue;

        try {
            const data = JSON.parse(parts[4]);
            if (data.covers && Array.isArray(data.covers)) {
                // Find if any cover ID in this record is in our target set
                const foundId = data.covers.find(id => targetIds.has(String(id)));
                if (foundId) {
                    const idStr = String(foundId);
                    const isbns = [];
                    if (data.isbn_13) isbns.push(...data.isbn_13);
                    if (data.isbn_10) isbns.push(...data.isbn_10);

                    if (isbns.length > 0) {
                        isbns.forEach(isbn => {
                            mapping[isbn] = idStr;
                        });
                        matchCount++;
                        // If we found all target IDs, we could stop, but IDs can map to multiple ISBNs
                    }
                }
            }
        } catch (e) {
            // Skip invalid JSON
        }

        // Safety break if we found all IDs (approximate since one ID can be in multiple records)
        // But since we want all ISBNs, we skip early exit for now or set a limit.
        if (matchCount >= targetIds.size && lineCount > 1000000) {
            // We might have found most, but let's keep going a bit or exit if it takes too long
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify(mapping, null, 2));
    console.log(`FINISHED. Found ${matchCount} matches. Mapping saved to ${outputPath}`);
    process.exit(0);
}

extractMapping().catch(err => {
    console.error(err);
    process.exit(1);
});
