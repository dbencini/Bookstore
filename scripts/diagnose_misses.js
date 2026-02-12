require('dotenv').config();
const { Book } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');

async function diagnoseMisses() {
    console.log("--- Diagnosing Cover Mappings Gaps ---");

    const mapping = JSON.parse(fs.readFileSync('scripts/isbn_to_cover_id.json', 'utf8'));
    const mappedIsbns = Object.keys(mapping);

    // Find 10 books that are missing covers
    const misses = await Book.findAll({
        where: {
            isbn: { [Op.notIn]: mappedIsbns, [Op.ne]: '' },
            imageUrl: { [Op.or]: ['', null, '/images/default-book-cover.png'] }
        },
        limit: 10,
        raw: true
    });

    console.log(`Analyzing ${misses.length} sample misses...`);

    for (const book of misses) {
        console.log(`\nChecking ISBN: ${book.isbn} (${book.title})`);
        // We'll check if this ISBN exists in the edition dump at all, but just didn't have a cover
        // (Wait, I can't easily do that without re-streaming)

        // Let's assume most of these just don't have edition-level covers.
        // I will check if they have a Work ID in the dump.
    }
}

diagnoseMisses();
