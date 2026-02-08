const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

async function analyzeStatuses() {
    const csvPath = path.join(__dirname, 'uploads', 'POD_Library.csv');
    const statusCounts = {};
    let totalRows = 0;

    console.log('Analyzing statuses in POD_Library.csv...');

    const stream = fs.createReadStream(csvPath).pipe(csv({
        mapHeaders: ({ header }) => header.replace(/^[^\w]+/, '').toLowerCase().trim()
    }));

    for await (const row of stream) {
        totalRows++;
        const status = (row.status || 'MISSING').toLowerCase();
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        if (totalRows % 1000000 === 0) {
            console.log(`Processed ${totalRows / 1000000}M rows...`);
        }
    }

    console.log('\n--- STATUS ANALYSIS ---');
    console.log('Total Rows:', totalRows.toLocaleString());
    for (const [status, count] of Object.entries(statusCounts)) {
        console.log(`${status}: ${count.toLocaleString()} (${((count / totalRows) * 100).toFixed(2)}%)`);
    }
}

analyzeStatuses().catch(console.error);
