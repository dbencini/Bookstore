const fs = require('fs');
const readline = require('readline');
const path = require('path');

/**
 * Build Author Lookup Cache from OpenLibraryAuthors.txt
 * Format: /type/author	/authors/OL46053A	5	timestamp	{"name": "Author Name", ...}
 */

async function buildAuthorCache() {
    const authorsPath = path.join(__dirname, 'uploads', 'OpenLibraryAuthors.txt');

    if (!fs.existsSync(authorsPath)) {
        throw new Error('OpenLibraryAuthors.txt not found in uploads directory!');
    }

    const authorCache = new Map();
    let processed = 0;
    let parsed = 0;
    const startTime = Date.now();

    const fileStream = fs.createReadStream(authorsPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        processed++;

        try {
            // Split by tabs
            const parts = line.split('\t');
            if (parts.length < 5) continue;

            const authorKey = parts[1]; // e.g., /authors/OL46053A
            const jsonData = parts[4];

            const record = JSON.parse(jsonData);

            if (record.name && authorKey) {
                // Extract just the ID (e.g., OL46053A)
                const authorId = authorKey.replace('/authors/', '');
                authorCache.set(authorId, record.name);
                parsed++;
            }
        } catch (err) {
            // Skip malformed lines
            continue;
        }
    }

    return authorCache;
}

module.exports = { buildAuthorCache };
