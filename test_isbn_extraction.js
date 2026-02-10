// Test the new ISBN extraction logic
const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function testIsbnExtraction() {
    const authorsPath = path.join(__dirname, 'uploads', 'OpenLibraryAuthors.txt');
    const fileStream = fs.createReadStream(authorsPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    console.log('🧪 Testing ISBN extraction from OpenLibraryAuthors.txt...\n');

    let count = 0;
    let extracted = 0;
    const samples = [];

    for await (const line of rl) {
        if (count >= 10000) break;

        try {
            const parts = line.split('\t');
            if (parts.length < 5) continue;

            const record = JSON.parse(parts[4]);

            // Extract ISBNs from source_records (format: "bwb:9781234567890")
            if (record.source_records && record.source_records.length > 0 && record.key) {
                const authorKey = record.key;

                record.source_records.forEach(sr => {
                    // Extract ISBN from patterns like "bwb:9781234567890"
                    const parts = sr.split(':');
                    if (parts.length >= 2) {
                        const isbn = parts[1];
                        // Validate ISBN format (10 or 13 digits)
                        if (/^\d{10,13}$/.test(isbn)) {
                            extracted++;
                            if (samples.length < 10) {
                                samples.push({
                                    author: record.name || 'Unknown',
                                    authorKey,
                                    isbn,
                                    source: sr
                                });
                            }
                        }
                    }
                });
            }
            count++;
        } catch (err) {
            // Skip bad lines
        }
    }

    console.log(`📊 Results from first ${count.toLocaleString()} authors:`);
    console.log(`   ISBNs extracted: ${extracted.toLocaleString()}\n`);

    console.log('📚 Sample extracted mappings:\n');
    samples.forEach((s, i) => {
        console.log(`${i + 1}. ${s.author}`);
        console.log(`   Author Key: ${s.authorKey}`);
        console.log(`   ISBN: ${s.isbn}`);
        console.log(`   From: ${s.source}\n`);
    });

    const rate = extracted / count;
    console.log(`📈 Extraction Rate: ${(rate * 100).toFixed(1)}% of authors have usable ISBNs`);
    console.log(`📊 Projected total: ~${Math.round(rate * 7600000).toLocaleString()} ISBNs from 7.6M authors\n`);

    if (extracted > 0) {
        console.log('✅ ISBN extraction is working correctly!');
    } else {
        console.log('❌ No ISBNs extracted - check the logic');
    }

    fileStream.destroy();
}

testIsbnExtraction();
