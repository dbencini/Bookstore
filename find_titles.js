const fs = require('fs');
const path = require('path');

async function findTitles() {
    const targetTitles = [
        'The Einstein Theory of Relativity',
        'Protecting His Curvy Girl',
        'Manapasun Manakade'
    ].map(t => t.toLowerCase());

    const dumpPath = path.join(__dirname, 'uploads/GoogleHugeFile.txt');
    console.log(`Searching for Titles: ${targetTitles.join(', ')}`);

    const fileHandle = fs.openSync(dumpPath, 'r');
    const bufferSize = 1024 * 1024;
    const buffer = Buffer.alloc(bufferSize);

    let bytesRead;
    let totalScanned = 0;
    let foundCount = 0;
    let currentLine = "";

    while ((bytesRead = fs.readSync(fileHandle, buffer, 0, bufferSize)) > 0) {
        let content = buffer.toString('utf8', 0, bytesRead);
        let lines = (currentLine + content).split('\n');
        currentLine = lines.pop();

        for (const line of lines) {
            totalScanned++;
            const lowerLine = line.toLowerCase();
            for (const title of targetTitles) {
                if (lowerLine.includes(title)) {
                    console.log(`\nFOUND MATCH FOR "${title}":`);
                    const parts = line.split('\t');
                    if (parts.length >= 5) {
                        console.log("Record Key:", parts[1]);
                        console.log("Full JSON Sample:", parts[4].substring(0, 1000) + "...");
                        try {
                            const data = JSON.parse(parts[4]);
                            console.log("Fields:", Object.keys(data).join(', '));
                            console.log("by_statement:", data.by_statement || "NONE");
                            console.log("authors:", JSON.stringify(data.authors || "NONE"));
                            console.log("contributors:", JSON.stringify(data.contributors || "NONE"));
                            console.log("notes:", data.notes || "NONE");
                        } catch (e) { }
                    }
                    foundCount++;
                }
            }
        }

        if (totalScanned % 200000 === 0) {
            process.stdout.write(`\rScanned ~${totalScanned.toLocaleString()} lines...`);
        }
        if (foundCount >= 15) break; // Limit results
    }

    fs.closeSync(fileHandle);
    console.log(`\n\nScan complete. Found ${foundCount} matches.`);
    process.exit(0);
}

findTitles().catch(console.error);
