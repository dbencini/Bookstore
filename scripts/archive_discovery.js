const axios = require('axios');
const fs = require('fs');

async function researchArchive() {
    console.log("--- Archive.org Discovery Script ---");

    const items = ['ol_exports', 'openlibrary_covers', 'ol_data'];

    for (const item of items) {
        console.log(`\nChecking Item: ${item}...`);
        try {
            const res = await axios.get(`https://archive.org/metadata/${item}`);
            const files = res.data.files || [];

            const mappings = files.filter(f =>
                f.name.includes('cover') ||
                f.name.includes('mapping') ||
                f.name.includes('id') ||
                f.name.includes('isbn')
            );

            if (mappings.length > 0) {
                console.log(`Found potential mapping files in ${item}:`);
                console.table(mappings.map(m => ({
                    name: m.name,
                    size: (m.size / 1024 / 1024).toFixed(2) + ' MB',
                    format: m.format
                })));
            } else {
                console.log(`No direct mapping files in ${item}.`);
            }
        } catch (e) {
            console.error(`Error checking ${item}: ${e.message}`);
        }
    }
}

researchArchive();
