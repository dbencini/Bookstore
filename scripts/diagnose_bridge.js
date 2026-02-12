const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function diagnose() {
    console.log("--- Diagnostic Phase: Sample Coverage Check ---");

    const mappingPath = path.join(__dirname, '../uploads/coverids.txt');
    const dumpPath = path.join(__dirname, '../uploads/OpenLibraryBooks.txt');

    // 1. Load a slice of the index
    const indexSample = new Set();
    const rlIdx = readline.createInterface({ input: fs.createReadStream(mappingPath), terminal: false });
    let idxCount = 0;
    for await (const line of rlIdx) {
        idxCount++;
        const key = line.split('\t')[0].trim();
        if (idxCount <= 1000000) indexSample.add(key); // First 1M
        if (idxCount > 10000000) break;
    }
    console.log(`Loaded ${indexSample.size} keys from index sample.`);

    // 2. Find editions in dump that HAVE covers and check if they are in our sample
    const rlDump = readline.createInterface({ input: fs.createReadStream(dumpPath), terminal: false });
    let hits = 0;
    let crossMatches = 0;

    for await (const line of rlDump) {
        if (line.includes('/type/edition') && line.includes('"covers"')) {
            hits++;
            const parts = line.split('\t');
            const key = parts[1].replace('/books/', '').trim();
            if (indexSample.has(key)) crossMatches++;

            if (hits <= 5) {
                console.log(`Sample Hit: ${key} | In Index Sample: ${indexSample.has(key)}`);
            }
        }
        if (hits >= 100) break;
    }
    console.log(`Summary: ${hits} editions with covers found in dump, ${crossMatches} matched in index sample.`);
}

diagnose();
