const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { Book } = require('./models');
const { Op } = require('sequelize');

async function inspectRawData() {
    console.log("Loading ISBNs missing authors from DB...");
    const books = await Book.findAll({
        where: {
            [Op.or]: [{ author: null }, { author: '' }, { author: 'Unknown' }],
            isbn: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
        },
        attributes: ['isbn', 'title'],
        limit: 10000
    });

    const isbnSet = new Set(books.map(b => b.isbn.replace(/[-\s]/g, '')));
    console.log(`Searching for ${isbnSet.size} ISBNs in GoogleHugeFile.txt...`);

    const dumpPath = path.join(__dirname, 'uploads/GoogleHugeFile.txt');
    const fileStream = fs.createReadStream(dumpPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let found = 0;
    for await (const line of rl) {
        const parts = line.split('\t');
        if (parts.length < 5) continue;

        const jsonStr = parts[4];
        try {
            const data = JSON.parse(jsonStr);
            const isbns = [
                ...(data.isbn_10 || []),
                ...(data.isbn_13 || [])
            ].map(i => i.replace(/[-\s]/g, ''));

            const match = isbns.find(i => isbnSet.has(i));
            if (match) {
                console.log("\n--- MATCH FOUND ---");
                console.log("ISBN:", match);
                console.log("Full JSON Sample:", jsonStr);
                found++;
                if (found >= 5) break;
            }
        } catch (e) { }
    }

    if (found === 0) console.log("No matches found in sample scan.");
    process.exit(0);
}

inspectRawData();
