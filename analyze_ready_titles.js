const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

async function analyzeReadyTitles() {
    const csvPath = path.join(__dirname, 'uploads', 'POD_Library.csv');
    let readyRows = 0;
    let uniqueTitles = new Set();
    let titleCollisions = 0;

    console.log('Analyzing title duplications in READY rows...');

    const stream = fs.createReadStream(csvPath).pipe(csv({
        mapHeaders: ({ header }) => header.replace(/^[^\w]+/, '').toLowerCase().trim()
    }));

    for await (const row of stream) {
        const status = (row.status || '').toLowerCase().trim();
        if (status !== 'ready') continue;

        readyRows++;
        const title = (row.title || row.heading || row.name || row.item || row.book || '').trim();

        if (uniqueTitles.has(title)) {
            titleCollisions++;
        } else {
            uniqueTitles.add(title);
        }

        if (readyRows % 1000000 === 0) {
            console.log(`Processed ${readyRows / 1000000}M ready rows...`);
        }
    }

    console.log('\n--- READY ROWS ANALYSIS ---');
    console.log('Total Ready Rows:', readyRows.toLocaleString());
    console.log('Unique Titles in Ready Rows:', uniqueTitles.size.toLocaleString());
    console.log('Duplicate Titles (Collisions):', titleCollisions.toLocaleString());
    console.log('Collision Percentage:', ((titleCollisions / readyRows) * 100).toFixed(2) + '%');
}

analyzeReadyTitles().catch(console.error);
