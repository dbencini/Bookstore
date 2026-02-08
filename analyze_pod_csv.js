const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function analyzeCsv() {
    const csvPath = path.join(__dirname, 'uploads', 'POD_Library.csv');
    if (!fs.existsSync(csvPath)) {
        console.error('File not found:', csvPath);
        return;
    }

    const fileStream = fs.createReadStream(csvPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let totalRows = 0;
    let missingInfo = 0;
    let duplicateIsbns = 0;
    let duplicateTitles = 0;
    let uniqueIsbns = new Set();
    let uniqueTitles = new Set();
    let isFirst = true;
    let headers = [];

    console.log('Starting analysis of POD_Library.csv...');

    for await (const line of rl) {
        if (isFirst) {
            headers = line.split(',').map(h => h.replace(/"/g, '').trim());
            isFirst = false;
            continue;
        }

        totalRows++;
        // Simple CSV parse for this specific format "isbn","title",...
        const parts = line.split('","').map(p => p.replace(/"/g, '').trim());

        let isbn = parts[0];
        let title = parts[1];

        if (!isbn && !title) {
            missingInfo++;
        } else if (isbn) {
            if (uniqueIsbns.has(isbn)) {
                duplicateIsbns++;
            } else {
                uniqueIsbns.add(isbn);
            }
        } else if (title) {
            if (uniqueTitles.has(title)) {
                duplicateTitles++;
            } else {
                uniqueTitles.add(title);
            }
        }

        if (totalRows % 1000000 === 0) {
            console.log(`Processed ${totalRows / 1000000}M rows...`);
        }
    }

    console.log('\n--- ANALYSIS RESULT ---');
    console.log('Total Data Rows:', totalRows.toLocaleString());
    console.log('Missing both ISBN & Title (Skipped):', missingInfo.toLocaleString());
    console.log('Duplicate ISBNs (Updated):', duplicateIsbns.toLocaleString());
    console.log('Duplicate Titles (no ISBN) (Updated):', duplicateTitles.toLocaleString());
    console.log('Unique Records Found:', (uniqueIsbns.size + uniqueTitles.size).toLocaleString());
    console.log('Difference:', (totalRows - (uniqueIsbns.size + uniqueTitles.size + missingInfo)).toLocaleString());
}

analyzeCsv();
