const fs = require('fs');
const readline = require('readline');

async function peekSubjects() {
    const rl = readline.createInterface({
        input: fs.createReadStream('uploads/GoogleHugeFile.txt'),
        crlfDelay: Infinity
    });

    let found = 0;
    for await (const line of rl) {
        if (line.includes('"subjects"')) {
            const parts = line.split('\t');
            const jsonPart = parts[parts.length - 1];
            try {
                const data = JSON.parse(jsonPart);
                if (data.subjects && data.subjects.length > 0) {
                    console.log('--- RECORD ' + (found + 1) + ' ---');
                    console.log('Title: ' + (data.title || 'Unknown'));
                    console.log('Subjects: ' + JSON.stringify(data.subjects, null, 2));
                    found++;
                    if (found >= 5) break;
                }
            } catch (e) { }
        }
    }
    process.exit(0);
}

peekSubjects();
