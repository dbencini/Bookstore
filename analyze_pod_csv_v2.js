const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

async function analyzeCsv() {
    const csvPath = path.join(__dirname, 'uploads', 'POD_Library.csv');
    let totalRows = 0;
    let uniqueIsbns = new Set();
    let uniqueTitles = new Set();
    let isbnCollisions = 0;
    let titleCollisions = 0; // Collisions where ISBN is missing or non-matching but TITLE exists
    let missingBoth = 0;
    let recordsToUpdate = 0;
    let recordsToAdd = 0;

    // Simulation of the import logic map
    const existingMap = new Set();

    console.log('Starting Deep Analysis of POD_Library.csv...');

    const stream = fs.createReadStream(csvPath).pipe(csv());

    for await (const row of stream) {
        totalRows++;
        const title = row.title || row.heading || row.name || row.item || row.book;
        const isbn = row.isbn || row.code || row.id || row.barcode;

        if (!title && !isbn) {
            missingBoth++;
            continue;
        }

        let isMatch = false;
        if (isbn && existingMap.has(`isbn:${isbn}`)) {
            isMatch = true;
            isbnCollisions++;
        } else if (title && existingMap.has(`title:${title}`)) {
            isMatch = true;
            titleCollisions++;
        }

        if (isMatch) {
            recordsToUpdate++;
        } else {
            recordsToAdd++;
            if (isbn) existingMap.add(`isbn:${isbn}`);
            if (title) existingMap.add(`title:${title}`);
        }

        if (totalRows % 500000 === 0) {
            console.log(`Processed ${totalRows / 1000000}M rows...`);
        }
    }

    console.log('\n--- DEEP ANALYSIS RESULT ---');
    console.log('Total Rows in CSV:', totalRows.toLocaleString());
    console.log('Records that would be ADDED:', recordsToAdd.toLocaleString());
    console.log('Records that would be UPDATED (Collisions):', recordsToUpdate.toLocaleString());
    console.log('  - Due to Duplicate ISBN:', isbnCollisions.toLocaleString());
    console.log('  - Due to Duplicate Title:', titleCollisions.toLocaleString());
    console.log('Empty Rows (Skipped):', missingBoth.toLocaleString());
    console.log('\nConclusion:');
    if (recordsToAdd < totalRows) {
        console.log(`The discrepancy of ${(totalRows - recordsToAdd).toLocaleString()} records is explained by duplicate primary identifiers (ISBN or Title) in the source file.`);
    } else {
        console.log('No internal collisions found in the CSV file itself.');
    }
}

analyzeCsv().catch(console.error);
