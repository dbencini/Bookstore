require('dotenv').config();
const bestsellerService = require('../services/bestsellerService');
const { Book, Category, BookCategory, Op, sequelize } = require('../models');
const fs = require('fs');
const path = require('path');

async function run() {
    console.log('--- Starting Bestseller Sync ---');
    console.log(`Time: ${new Date().toLocaleString()}`);

    const nytKey = process.env.NYT_API_KEY;
    const googleKey = process.env.GOOGLE_BOOK_API;

    try {
        // 1. Fetch from APIs
        console.log('Fetching aggregated bestsellers from APIs...');
        const results = await bestsellerService.getAllBestsellers({
            nytApiKey: nytKey,
            googleApiKey: googleKey
        });

        const allSourceBooks = [
            ...results.amazon,
            ...results.nyt,
            ...results.bn,
            ...results.google
        ];

        console.log(`Total bestsellers found across sources: ${allSourceBooks.length}`);

        // 2. Ensure "Bestseller" category exists
        const [bestsellerCategory] = await Category.findOrCreate({
            where: { name: 'Bestseller' },
            defaults: { priority: 100 }
        });

        // 3. Clear existing links in "Bestseller" category
        console.log(`Clearing old links from "Bestseller" category (ID: ${bestsellerCategory.id})...`);
        const deletedCount = await BookCategory.destroy({
            where: { CategoryId: bestsellerCategory.id }
        });
        console.log(`Cleared ${deletedCount} links.`);

        // 4. Match and Link
        console.log('Matching against local database...');
        let matchCount = 0;
        const linkedIsbns = new Set();
        const DEFAULT_PRICE = 19.99;

        for (const b of allSourceBooks) {
            console.log(`Checking book: "${b.title}" (ISBN: ${b.isbn}, Author: ${b.author})`);
            if (!b.isbn && !b.title) {
                console.log(' - Missing ISBN and Title, skipping.');
                continue;
            }

            // Clean ISBN for matching
            const cleanIsbn = b.isbn ? b.isbn.replace(/[-\s]/g, '') : null;
            if (cleanIsbn && linkedIsbns.has(cleanIsbn)) {
                console.log(` - ISBN ${cleanIsbn} already processed, skipping.`);
                continue;
            }

            let localBook = null;

            // Step A: Try ISBN match first (FAST, uses unique index)
            if (cleanIsbn) {
                localBook = await Book.findOne({
                    where: { isbn: cleanIsbn }
                });
                if (localBook) console.log(` - ISBN Match Found: ${localBook.title}`);
            }

            // Step B: Try Exact Title Match (FAST, uses index)
            if (!localBook && b.title) {
                console.log(` - ISBN Match failed. Trying exact title match for "${b.title}"...`);
                localBook = await Book.findOne({
                    where: { title: b.title.trim() }
                });
                if (localBook) console.log(` - [EXACT MATCH] Found: ${localBook.title}`);
            }

            // Step C: High-Performance Fulltext Match (Uses Fulltext index)
            if (!localBook && b.title) {
                const cleanTitleForFT = b.title.replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
                console.log(` - Exact Match failed. Trying Fulltext search for "${cleanTitleForFT}"...`);

                localBook = await Book.findOne({
                    where: sequelize.literal(`MATCH(title, author) AGAINST(${sequelize.escape(cleanTitleForFT)} IN NATURAL LANGUAGE MODE)`)
                });

                if (localBook) {
                    console.log(` - [FULLTEXT MATCH] Found: ${localBook.title}`);
                } else {
                    console.log(' - No match found by any method.');
                }
            }

            if (localBook) {
                // Link to category
                console.log(` - Linking ${localBook.title} to Bestseller...`);
                await BookCategory.findOrCreate({
                    where: {
                        BookId: localBook.id,
                        CategoryId: bestsellerCategory.id
                    }
                });

                // --- AUTO-VISIBILITY & REPAIR ---
                let updated = false;

                // 1. Force visibility
                if (!localBook.isVisible) {
                    localBook.isVisible = true;
                    updated = true;
                    console.log(`   -> Set Visible: ${localBook.title}`);
                }

                // 2. Fix Price if missing
                if (!localBook.price || localBook.price === 0) {
                    if (localBook.price_cost && localBook.price_cost > 0) {
                        localBook.price = parseFloat((localBook.price_cost * 1.15).toFixed(2));
                    } else {
                        localBook.price = DEFAULT_PRICE;
                    }
                    updated = true;
                    console.log(`   -> Updated Price: ${localBook.price}`);
                }

                // 3. Fix Image if it's a placeholder but the source has a real one
                const isPlaceholder = !localBook.imageUrl ||
                    localBook.imageUrl.includes('placehold.co') ||
                    localBook.imageUrl.includes('default_cover.svg');

                if (isPlaceholder && b.image && b.image.startsWith('http')) {
                    localBook.imageUrl = b.image;
                    updated = true;
                    console.log(`   -> Updated Image: ${localBook.imageUrl}`);
                }

                // 4. Fix Author if it's "Unknown" or missing
                const isUnknownAuthor = !localBook.author || localBook.author.toLowerCase() === 'unknown';
                if (isUnknownAuthor && b.author && b.author.toLowerCase() !== 'unknown') {
                    localBook.author = b.author;
                    updated = true;
                    console.log(`   -> Repaired Author: ${localBook.author}`);
                }

                if (updated) {
                    await localBook.save();
                }

                if (localBook.isbn) linkedIsbns.add(localBook.isbn);
                matchCount++;
                console.log(`[MATCH] Linked and verified: ${localBook.title}`);
            }
        }

        console.log('-----------------------------------');
        console.log(`Sync Complete. Matches Found & Linked: ${matchCount}`);

        // Update book count for the category
        await bestsellerCategory.update({ book_count: matchCount });

        // Save raw results for debug
        const outputPath = path.join(__dirname, '../data_bestsellers.json');
        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

    } catch (error) {
        console.error('Fatal error during bestseller sync:', error);
    }
    process.exit(0);
}

run();
