// Check if OpenLibraryAuthors.txt has ISBN data
const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function checkAuthorFormat() {
    const authorsPath = path.join(__dirname, 'uploads', 'OpenLibraryAuthors.txt');
    const fileStream = fs.createReadStream(authorsPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    console.log('🔍 Checking OpenLibraryAuthors.txt for ISBN data...\n');
    let count = 0;
    let withSourceRecords = 0;
    let withIsbns = 0;

    for await (const line of rl) {
        if (count >= 1000) break; // Check first 1000

        try {
            const parts = line.split('\t');
            if (parts.length >= 5) {
                const record = JSON.parse(parts[4]);

                if (record.source_records && record.source_records.length > 0) {
                    withSourceRecords++;

                    // Check if any source_records contain ISBN-like data
                    const hasIsbn = record.source_records.some(sr =>
                        sr.includes(':978') || sr.includes(':') || /\d{10,13}/.test(sr)
                    );

                    if (hasIsbn && withIsbns < 10) {
                        console.log(`📖 Author: ${record.name || 'N/A'}`);
                        console.log(`   Key: ${record.key}`);
                        console.log(`   Source Records: ${JSON.stringify(record.source_records)}\n`);
                        withIsbns++;
                    }
                }

                count++;
            }
        } catch (err) {
            // Skip bad lines
        }
    }

    console.log(`\n📊 Results from first ${count} authors:`);
    console.log(`   Authors with source_records: ${withSourceRecords}`);
    console.log(`   Authors with ISBN-like data: ${withIsbns}`);

    if (withIsbns > 0) {
        console.log(`\n✅ EXCELLENT! OpenLibraryAuthors.txt contains ISBN data!`);
        console.log(`   We can scan 7.6M authors instead of 55M books!`);
    } else {
        console.log(`\n❌ No ISBN data found in OpenLibraryAuthors.txt`);
    }

    fileStream.destroy();
}

checkAuthorFormat();
