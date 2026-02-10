// Check the actual structure of OpenLibraryBooks.txt records
const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function checkBookFormat() {
    const booksPath = path.join(__dirname, 'uploads', 'OpenLibraryBooks.txt');
    const fileStream = fs.createReadStream(booksPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    console.log('🔍 Checking OpenLibraryBooks.txt format...\n');
    let count = 0;

    for await (const line of rl) {
        if (count >= 5) break;

        try {
            const parts = line.split('\t');
            if (parts.length >= 5) {
                const record = JSON.parse(parts[4]);

                console.log(`\n📖 Record ${count + 1}:`);
                console.log(`Title: ${record.title || 'N/A'}`);
                console.log(`ISBN-13: ${record.isbn_13 ? record.isbn_13.join(', ') : 'NONE'}`);
                console.log(`ISBN-10: ${record.isbn_10 ? record.isbn_10.join(', ') : 'NONE'}`);
                console.log(`Source Records: ${record.source_records ? JSON.stringify(record.source_records) : 'NONE'}`);
                console.log(`Authors: ${record.authors ? JSON.stringify(record.authors).substring(0, 100) : 'NONE'}`);

                count++;
            }
        } catch (err) {
            // Skip bad lines
        }
    }

    fileStream.destroy();
}

checkBookFormat();
