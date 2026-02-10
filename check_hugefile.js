const fs = require('fs');
const readline = require('readline');

async function checkFile() {
    const fileStream = fs.createReadStream('uploads/OpenLibraryBooks.txt');
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let lineCount = 0;
    let authorCount = 0;

    for await (const line of rl) {
        if (lineCount >= 10) break;
        lineCount++;

        try {
            // Try to parse as JSON
            const parts = line.split('\t');
            if (parts.length >= 5) {
                const jsonPart = parts[4];
                const record = JSON.parse(jsonPart);

                console.log(`\n--- Record ${lineCount} ---`);
                console.log('ISBN:', record.isbn_13 || record.isbn_10 || 'Unknown');
                console.log('Title:', (record.title || '').substring(0, 60));

                if (record.authors && record.authors.length > 0) {
                    console.log('Authors:', record.authors.map(a => a.name || a.key).join(', '));
                    authorCount++;
                } else {
                    console.log('Authors: MISSING');
                }
            }
        } catch (err) {
            console.log(`Line ${lineCount}: Could not parse`);
        }
    }

    console.log(`\n\nSummary: ${authorCount}/${lineCount} records have authors`);
}

checkFile().catch(console.error);
