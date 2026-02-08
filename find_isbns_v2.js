const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function findISBNs() {
    const targetISBNs = ['9789390063765', '9781967463015', '9789384316174'];
    const dumpPath = path.join(__dirname, 'uploads/GoogleHugeFile.txt');

    console.log(`Searching for ISBNs: ${targetISBNs.join(', ')}`);

    // Increased heap size might be needed for very long lines, but let's try reading manually
    const fileHandle = fs.openSync(dumpPath, 'r');
    const bufferSize = 1024 * 1024; // 1MB chunks
    const buffer = Buffer.alloc(bufferSize);

    let bytesRead;
    let totalScanned = 0;
    let foundCount = 0;
    let currentLine = "";

    while ((bytesRead = fs.readSync(fileHandle, buffer, 0, bufferSize)) > 0) {
        let content = buffer.toString('utf8', 0, bytesRead);
        let lines = (currentLine + content).split('\n');
        currentLine = lines.pop(); // Last incomplete line

        for (const line of lines) {
            totalScanned++;
            for (const isbn of targetISBNs) {
                if (line.includes(isbn)) {
                    console.log(`\nFOUND MATCH FOR ${isbn}:`);
                    // Extract just the JSON portion to avoid console flooding if it's huge
                    const parts = line.split('\t');
                    if (parts.length >= 5) {
                        console.log("Record Key:", parts[1]);
                        console.log("Data JSON:", parts[4].substring(0, 2000) + "...");
                        // Let's also check for sub-fields
                        try {
                            const data = JSON.parse(parts[4]);
                            console.log("Fields found:", Object.keys(data).join(', '));
                            console.log("by_statement:", data.by_statement || "NONE");
                            console.log("authors:", JSON.stringify(data.authors || "NONE"));
                            console.log("contributors:", JSON.stringify(data.contributors || "NONE"));
                        } catch (e) { }
                    }
                    foundCount++;
                }
            }
        }

        if (totalScanned % 100000 < 100) {
            process.stdout.write(`\rScanned ~${totalScanned.toLocaleString()} lines...`);
        }
        if (foundCount >= targetISBNs.length) break;
    }

    fs.closeSync(fileHandle);
    console.log(`\n\nScan complete. Found ${foundCount} matches.`);
    process.exit(0);
}

findISBNs().catch(console.error);
