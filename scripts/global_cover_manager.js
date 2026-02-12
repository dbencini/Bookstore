require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * UNIFIED GLOBAL COVER MANAGER
 * protocol: docs/RunButton.md
 */

const mode = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

async function run() {
    console.log(`--- [Global Cover Manager] Mode: ${mode} ---`);

    try {
        if (mode === 'find' || mode === 'find-mapping') {
            const query = arg1 || 'Open Library covers metadata';
            console.log(`Searching Archive.org for: "${query}"...`);
            const res = await axios.get(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&output=json`);
            const docs = res.data.response.docs;
            if (docs.length > 0) {
                console.log(`Found ${docs.length} items:`);
                docs.forEach(d => console.log(`- ${d.identifier}: ${d.title}`));
            } else {
                console.log("No items found.");
            }
        }

        else if (mode === 'check' || mode === 'check-archive') {
            const itemId = arg1 || 'ol_exports';
            console.log(`Scanning Item: ${itemId}...`);
            const res = await axios.get(`https://archive.org/metadata/${itemId}`);
            const files = res.data.files || [];
            console.log(`Listing ${files.length} files:`);
            files.forEach(f => {
                if (!arg2 || f.name.includes(arg2)) {
                    console.log(`- ${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`);
                }
            });
        }

        else if (mode === 'download') {
            const url = arg1;
            const dest = arg2 || path.join(__dirname, path.basename(url));
            if (!url) throw new Error("URL required for download.");
            console.log(`Downloading ${url} to ${dest}...`);
            const writer = fs.createWriteStream(dest);
            const response = await axios({ url, method: 'GET', responseType: 'stream' });
            response.data.pipe(writer);
            return new Promise((resolve, reject) => {
                writer.on('finish', () => { console.log("Download complete."); resolve(); });
                writer.on('error', reject);
            });
        }

        else if (mode === 'scrape') {
            const url = arg1 || 'https://archive.org/details/ol_exports';
            console.log(`Scraping ${url}...`);
            const res = await axios.get(url);
            const html = res.data;
            const matches = html.match(/\/details\/ol_dump_[0-9-]+/g) || [];
            console.log(`Found ${[...new Set(matches)].length} unique dump links:`);
            [...new Set(matches)].forEach(m => console.log(`- https://archive.org${m}`));
        }

        else if (mode === 'process') {
            const { Book } = require('../models');
            const { Op } = require('sequelize');
            const readline = require('readline');
            const mappingPath = arg1 || path.join(__dirname, '../uploads/coverids.txt');

            if (!fs.existsSync(mappingPath)) throw new Error(`Mapping file not found: ${mappingPath}`);

            console.log("Loading ISBNs from database...");
            const books = await Book.findAll({
                attributes: ['isbn'],
                where: {
                    [Op.or]: [
                        { imageUrl: '' },
                        { imageUrl: null },
                        { imageUrl: '/images/default-book-cover.png' },
                        { imageUrl: { [Op.like]: '%google.com%' } },
                        { imageUrl: { [Op.like]: '%amazon.com%' } }
                    ]
                },
                raw: true
            });
            const ourIsbns = new Set(books.map(b => b.isbn.replace(/[-\s]/g, '')).filter(Boolean));
            console.log(`Searching for covers for ${ourIsbns.size} ISBNs...`);

            const finalMapping = {};
            const rl = readline.createInterface({
                input: fs.createReadStream(mappingPath),
                terminal: false
            });

            rl.on('line', (line) => {
                const parts = line.split('\t');
                // Format check for coverids.txt (4 columns) or others
                if (parts.length >= 4 && parts[0] === 'isbn') {
                    const isbn = parts[1].replace(/[-\s]/g, '');
                    const coverId = parts[3];
                    if (ourIsbns.has(isbn)) {
                        finalMapping[isbn] = coverId;
                    }
                }
            });

            rl.on('close', () => {
                const outPath = path.join(__dirname, 'isbn_to_cover_id_v2.json');
                fs.writeFileSync(outPath, JSON.stringify(finalMapping, null, 2));
                console.log(`Finished. Found ${Object.keys(finalMapping).length} new mappings. Saved to ${outPath}`);
                process.exit(0);
            });
            return;
        }

        else {
            console.log("Modes: find [query], check [itemID] [filter], download [URL] [dest], process [file]");
        }
    } catch (e) {
        console.error(`FAILURE: ${e.message}`);
    }
}

run();
