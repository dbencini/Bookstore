const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { sequelize, Book } = require('./models');
const { buildAuthorCache } = require('./build_author_cache');

/**
 * Repair Authors Using Open Library Data
 * NO API CALLS - Uses local dumps only!
 */

async function repairAuthors() {
    console.log('='.repeat(60));
    console.log('AUTHOR REPAIR - Open Library Local Data');
    console.log('='.repeat(60));
    console.log();

    try {
        // Step 1: Build author cache
        console.log('STEP 1: Building author lookup cache...');
        const authorCache = await buildAuthorCache();
        console.log();

        // Step 2: Get books missing authors
        console.log('STEP 2: Fetching books with missing authors...');
        await sequelize.authenticate();

        const [countResult] = await sequelize.query(`
            SELECT COUNT(*) as count 
            FROM books 
            WHERE (author IS NULL OR author = '' OR author = 'Unknown')
            AND isbn IS NOT NULL AND isbn != ''
        `);

        const totalMissing = countResult[0].count;
        console.log(`   Found: ${totalMissing.toLocaleString()} books missing authors\n`);

        if (totalMissing === 0) {
            console.log('✅ No books need author repair!');
            await sequelize.close();
            return;
        }

        // Step 3: Build ISBN -> Author Keys map from OpenLibraryBooks.txt
        console.log('STEP 3: Mapping ISBNs to author keys from OpenLibraryBooks.txt...');
        const booksPath = path.join(__dirname, 'uploads', 'OpenLibraryBooks.txt');

        if (!fs.existsSync(booksPath)) {
            throw new Error('OpenLibraryBooks.txt not found!');
        }

        const isbnToAuthorKeys = new Map();
        let booksProcessed = 0;
        let booksWithAuthors = 0;
        const startTime = Date.now();

        const fileStream = fs.createReadStream(booksPath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            booksProcessed++;

            if (booksProcessed % 100000 === 0) {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`   Scanned: ${booksProcessed.toLocaleString()} | Mapped: ${booksWithAuthors.toLocaleString()} | Time: ${elapsed}s`);
            }

            try {
                const parts = line.split('\t');
                if (parts.length < 5) continue;

                const jsonData = parts[4];
                const record = JSON.parse(jsonData);

                // Extract ISBNs
                const isbns = [];
                if (record.isbn_13) isbns.push(...record.isbn_13);
                if (record.isbn_10) isbns.push(...record.isbn_10);

                // Extract author keys
                if (record.authors && record.authors.length > 0 && isbns.length > 0) {
                    const authorKeys = record.authors.map(a => {
                        if (typeof a === 'string') return a;
                        if (a.key) return a.key;
                        if (a.author && a.author.key) return a.author.key;
                        return null;
                    }).filter(k => k);

                    if (authorKeys.length > 0) {
                        isbns.forEach(isbn => {
                            isbnToAuthorKeys.set(isbn, authorKeys);
                        });
                        booksWithAuthors++;
                    }
                }
            } catch (err) {
                continue;
            }
        }

        const scanTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`   ✅ Scanned: ${booksProcessed.toLocaleString()} | Mapped: ${booksWithAuthors.toLocaleString()} | Time: ${scanTime}s\n`);

        // Step 4: Update database
        console.log('STEP 4: Updating database with resolved author names...');

        const BATCH_SIZE = 1000;
        let offset = 0;
        let totalUpdated = 0;
        const updateStartTime = Date.now();

        while (true) {
            const books = await Book.findAll({
                where: {
                    [sequelize.Sequelize.Op.or]: [
                        { author: null },
                        { author: '' },
                        { author: 'Unknown' }
                    ],
                    isbn: { [sequelize.Sequelize.Op.ne]: null }
                },
                limit: BATCH_SIZE,
                offset: offset,
                attributes: ['id', 'isbn', 'author']
            });

            if (books.length === 0) break;

            for (const book of books) {
                const authorKeys = isbnToAuthorKeys.get(book.isbn);

                if (authorKeys && authorKeys.length > 0) {
                    // Resolve author keys to names
                    const authorNames = authorKeys
                        .map(key => {
                            const authorId = key.replace('/authors/', '');
                            return authorCache.get(authorId);
                        })
                        .filter(name => name);

                    if (authorNames.length > 0) {
                        book.author = authorNames.join(', ').substring(0, 2000);
                        await book.save();
                        totalUpdated++;
                    }
                }
            }

            offset += BATCH_SIZE;
            const elapsed = ((Date.now() - updateStartTime) / 1000).toFixed(1);
            console.log(`   Updated: ${totalUpdated.toLocaleString()} / ${totalMissing.toLocaleString()} | Time: ${elapsed}s`);
        }

        const totalTime = ((Date.now() - updateStartTime) / 1000 / 60).toFixed(1);
        console.log();
        console.log('='.repeat(60));
        console.log(`✅ REPAIR COMPLETE!`);
        console.log(`   Authors added: ${totalUpdated.toLocaleString()}`);
        console.log(`   Total time: ${totalTime} minutes`);
        console.log('='.repeat(60));

        await sequelize.close();

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

// Run the repair
if (require.main === module) {
    repairAuthors();
}

module.exports = { repairAuthors };
