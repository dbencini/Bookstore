const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function findISBNs() {
    const targetISBNs = ['9789390063765', '9781967463015', '9789384316174'];
    const dumpPath = path.join(__dirname, 'uploads/GoogleHugeFile.txt');

    console.log(`Searching for ISBNs: ${targetISBNs.join(', ')}`);
    console.log(`In: ${dumpPath}`);

    const fileStream = fs.createReadStream(dumpPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let linesRead = 0;
    let foundCount = 0;

    for await (const line of rl) {
        linesRead++;
        for (const isbn of targetISBNs) {
            if (line.includes(isbn)) {
                console.log(`\n[Line ${linesRead}] FOUND MATCH FOR ${isbn}:`);
                console.log(line);
                foundCount++;
            }
        }
        if (linesRead % 100000 === 0) {
            process.stdout.write(`\rScanned ${linesRead.toLocaleString()} lines...`);
        }
        if (foundCount >= targetISBNs.length * 2) break; // Allow for duplicate entries
    }

    console.log(`\n\nScan complete. Found ${foundCount} lines.`);
    process.exit(0);
}

findISBNs().catch(console.error);
