const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'uploads', 'GoogleHugeFile.txt');

async function countLines() {
    console.log(`Starting count for: ${filePath}`);
    const stream = fs.createReadStream(filePath);
    let count = 0;
    let bytesRead = 0;
    const totalSize = fs.statSync(filePath).size;
    let lastLog = Date.now();

    stream.on('data', (chunk) => {
        for (let i = 0; i < chunk.length; i++) {
            if (chunk[i] === 10) count++; // Newline \n
        }
        bytesRead += chunk.length;

        if (Date.now() - lastLog > 5000) {
            const percent = ((bytesRead / totalSize) * 100).toFixed(1);
            console.log(`Progress: ${percent}% (${(bytesRead / 1024 / 1024 / 1024).toFixed(1)} GB / ${(totalSize / 1024 / 1024 / 1024).toFixed(1)} GB) - Found ${count.toLocaleString()} lines...`);
            lastLog = Date.now();
        }
    });

    stream.on('end', () => {
        console.log(`\nFINAL_COUNT: ${count.toLocaleString()}`);
        process.exit(0);
    });

    stream.on('error', (err) => {
        console.error('Error reading file:', err);
        process.exit(1);
    });
}

countLines();
