/**
 * One-Time Visibility Update Script
 * 
 * This script updates ALL books in the database to enforce visibility rules:
 * 1. Auto-calculate price from price_cost + 15% if missing
 * 2. Set isVisible = true ONLY if book has: price, title, author, and valid image
 * 3. Set isVisible = false otherwise
 * 
 * Run this with: node scripts/update_book_visibility.js
 */

require('dotenv').config();
const { Book, sequelize } = require('../models');
const { Op } = require('sequelize');

async function updateBookVisibility() {
    console.log('=== Starting One-Time Visibility Update ===\n');

    let totalProcessed = 0;
    let pricesCalculated = 0;
    let madeVisible = 0;
    let madeHidden = 0;

    try {
        // Get total count for progress tracking
        const totalBooks = await Book.count();
        console.log(`Total books in database: ${totalBooks.toLocaleString()}\n`);

        const BATCH_SIZE = 1000;
        let offset = 0;

        while (true) {
            const books = await Book.findAll({
                limit: BATCH_SIZE,
                offset: offset,
                order: [['id', 'ASC']]
            });

            if (books.length === 0) break;

            for (const book of books) {
                let updated = false;

                // Step 1: Auto-calculate price from cost if missing
                if ((!book.price || book.price === 0) && book.price_cost && book.price_cost > 0) {
                    book.price = parseFloat((book.price_cost * 1.15).toFixed(2));
                    updated = true;
                    pricesCalculated++;
                }

                // Step 2: Determine visibility based on completeness
                const hasPrice = book.price && book.price > 0;
                const hasTitle = book.title && book.title.trim().length > 0;
                const hasAuthor = book.author && book.author !== 'Unknown' && book.author.trim().length > 0;
                const hasImage = book.imageUrl &&
                    !book.imageUrl.includes('placehold.co') &&
                    !book.imageUrl.includes('default_cover.svg') &&
                    !book.imageUrl.includes('placeholder-book.png');

                const shouldBeVisible = hasPrice && hasTitle && hasAuthor && hasImage;

                if (book.isVisible !== shouldBeVisible) {
                    book.isVisible = shouldBeVisible;
                    updated = true;

                    if (shouldBeVisible) {
                        madeVisible++;
                    } else {
                        madeHidden++;
                    }
                }

                if (updated) {
                    await book.save();
                }

                totalProcessed++;
            }

            offset += BATCH_SIZE;

            // Progress update every 10,000 books
            if (totalProcessed % 10000 === 0) {
                const percent = ((totalProcessed / totalBooks) * 100).toFixed(1);
                console.log(`Progress: ${totalProcessed.toLocaleString()} / ${totalBooks.toLocaleString()} (${percent}%)`);
            }
        }

        console.log('\n=== Update Complete ===');
        console.log(`Total books processed: ${totalProcessed.toLocaleString()}`);
        console.log(`Prices calculated (cost + 15%): ${pricesCalculated.toLocaleString()}`);
        console.log(`Books made VISIBLE: ${madeVisible.toLocaleString()}`);
        console.log(`Books made HIDDEN: ${madeHidden.toLocaleString()}`);
        console.log('\nVisibility Requirements:');
        console.log('  ✅ Has price (selling price)');
        console.log('  ✅ Has title');
        console.log('  ✅ Has author (not "Unknown")');
        console.log('  ✅ Has valid image (not placeholder)');

    } catch (err) {
        console.error('ERROR:', err);
        process.exit(1);
    }

    process.exit(0);
}

// Run the update
updateBookVisibility();
