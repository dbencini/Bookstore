require('dotenv').config();
const { sequelize, Book, Category, BookCategory, Job, Op, OpenLibraryAuthor } = require('./models');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');

// --- CONFIGURATION ---
const CSV_PATH = path.join(__dirname, 'uploads', 'POD_Library.csv');
const DUMP_PATHS = [
    path.join(__dirname, 'uploads', 'OpenLibraryBooks.txt'),
    path.join(__dirname, 'uploads', 'ol_dump_editions.txt')
];
const PROGRESS_FILE = path.join(__dirname, 'migration_progress.json');
const BATCH_SIZE = 2000;

async function migrate() {
    console.log('\n=================================================');
    console.log('--- MASTER RESUMABLE MIGRATION & REPAIR ENGINE ---');
    console.log('=================================================\n');

    try {
        await sequelize.authenticate();
        console.log('[Step 0] Connected to MySQL.');

        let progress = { phase: 'import', csvRow: 0, repairLine: 0, deepRepairLine: 0 };

        // Handle command line arguments to force a phase
        const args = process.argv.slice(2);
        const phaseArg = args.find(a => a.startsWith('--phase='));

        if (phaseArg) {
            const forcedPhase = phaseArg.split('=')[1];
            progress.phase = forcedPhase;
            console.log(`[Step 0] Forced Phase: ${forcedPhase} via command line.`);
        } else if (fs.existsSync(PROGRESS_FILE)) {
            const saved = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
            progress = { ...progress, ...saved };
            console.log(`[Step 0] Found existing progress: Phase ${progress.phase} at index ${progress.csvRow || progress.repairLine || progress.deepRepairLine}`);
        }

        // --- PHASE 1: CSV IMPORT ---
        if (progress.phase === 'import') {
            await runImportPhase(progress);
            progress.phase = 'repair';
            progress.repairLine = 0;
            saveProgress(progress);
        }

        // --- PHASE 2: ULTIMATE REPAIR ---
        if (progress.phase === 'repair') {
            await runRepairPhase(progress);
            progress.phase = 'deep_author_repair';
            progress.deepRepairLine = 0;
            saveProgress(progress);
        }

        // --- PHASE 3: DEEP AUTHOR REPAIR (BY_STATEMENT EXTRACTION) ---
        if (progress.phase === 'deep_author_repair') {
            await runDeepRepairPhase(progress);
            console.log('\n[Finished] All phases complete! Your library is fully imported and enriched.');
            if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
        }

        process.exit(0);
    } catch (err) {
        console.error('\n[FATAL ERROR] Migration crashed:', err);
        process.exit(1);
    }
}

async function runImportPhase(progress) {
    console.log('\n--- PHASE 1: RESUMABLE CSV IMPORT ---');
    if (!fs.existsSync(CSV_PATH)) throw new Error(`CSV not found at ${CSV_PATH}`);

    const startTime = Date.now();
    let rowCount = 0;
    let processedInPhase = 0;
    let batch = [];
    const seenTitles = new Set();

    // Warm up Category Cache
    const existingCats = await Category.findAll();
    const categoryMap = {};
    existingCats.forEach(c => categoryMap[c.name] = c.id);

    const stream = fs.createReadStream(CSV_PATH).pipe(csv({
        mapHeaders: ({ header }) => header.replace(/^[^\w]+/, '').toLowerCase().trim()
    }));

    console.log(`Starting/Resuming CSV stream from row ${progress.csvRow}...`);

    for await (const row of stream) {
        rowCount++;
        if (rowCount <= progress.csvRow) continue; // Resume logic

        const status = (row.status || '').toLowerCase().trim();
        if (status !== 'ready') continue;

        const title = (row.title || row.heading || row.name || row.item || row.book || '').trim();
        const isbn = (row.isbn || row.code || row.id || row.barcode || '').trim();
        const bind = (row.bind || '').trim();

        if (!title && !isbn) continue;

        let importComment = null;
        if (seenTitles.has(title)) {
            importComment = `Duplication due to ${bind || 'alternate'} version of the book`;
        }
        seenTitles.add(title);

        const categoryName = row.category || 'New Books';
        if (!categoryMap[categoryName]) {
            const [newCat] = await Category.findOrCreate({ where: { name: categoryName } });
            categoryMap[categoryName] = newCat.id;
        }

        const cost = parseFloat(row.price_cost || row.cost || row.price) || 0;

        batch.push({
            title: (title || 'Unknown Title').substring(0, 255),
            author: (row.author || 'Unknown').substring(0, 2000),
            description: (row.description || 'No description available.').substring(0, 4000),
            price: cost || 19.99,
            price_cost: cost,
            imageUrl: (row.imageurl || '/images/default_cover.svg').substring(0, 255),
            isbn: isbn || null,
            status: 'ready',
            bind: bind || null,
            isVisible: true,
            import_comment: importComment,
            createdAt: new Date(),
            updatedAt: new Date(),
            _categoryName: categoryName // Temporary field for linking
        });

        if (batch.length >= BATCH_SIZE) {
            await Book.bulkCreate(batch, { ignoreDuplicates: true });

            const titlesInBatch = batch.map(b => b.title);
            const booksInDb = await Book.findAll({
                where: { title: { [Op.in]: titlesInBatch } },
                attributes: ['id', 'title']
            });

            const linkBatch = [];
            booksInDb.forEach(book => {
                const batchReq = batch.find(b => b.title === book.title);
                if (batchReq) {
                    const catId = categoryMap[batchReq._categoryName];
                    if (catId) {
                        linkBatch.push({ BookId: book.id, CategoryId: catId });
                    }
                }
            });

            if (linkBatch.length > 0) {
                await BookCategory.bulkCreate(linkBatch, { ignoreDuplicates: true });
            }

            processedInPhase += batch.length;
            batch = [];
            progress.csvRow = rowCount;
            saveProgress(progress);

            const elapsed = (Date.now() - startTime) / 1000;
            console.log(`  Import Progress: ${rowCount.toLocaleString()} rows | Processed: ${processedInPhase.toLocaleString()} | Rate: ${(rowCount / elapsed).toFixed(0)} rec/s`);
        }
    }

    if (batch.length > 0) {
        await Book.bulkCreate(batch, { ignoreDuplicates: true });

        const titlesInBatch = batch.map(b => b.title);
        const booksInDb = await Book.findAll({
            where: { title: { [Op.in]: titlesInBatch } },
            attributes: ['id', 'title']
        });

        const linkBatch = [];
        booksInDb.forEach(book => {
            const batchReq = batch.find(b => b.title === book.title);
            if (batchReq) {
                const catId = categoryMap[batchReq._categoryName];
                if (catId) {
                    linkBatch.push({ BookId: book.id, CategoryId: catId });
                }
            }
        });

        if (linkBatch.length > 0) {
            await BookCategory.bulkCreate(linkBatch, { ignoreDuplicates: true });
        }
        processedInPhase += batch.length;
    }
    saveProgress(progress);
    console.log(`[Phase 1] Complete. Total Ready Books processed: ${processedInPhase.toLocaleString()}`);
}

async function runRepairPhase(progress) {
    console.log('\n--- PHASE 2: RESUMABLE ULTIMATE REPAIR (ENRICHMENT) ---');

    // 1. Find the local dump file
    const activePath = DUMP_PATHS.find(p => fs.existsSync(p));
    if (!activePath) {
        console.log('[Phase 2] WARNING: No Open Library dump found (OpenLibraryBooks.txt). Skipping Enrichment Phase.');
        return;
    }
    console.log(`[Phase 2] Using dump: ${path.basename(activePath)}`);

    // 2. Index ISBNs that still need fixing
    console.log('[Phase 2] Indexing books that need Author/Desc/Image repair...');
    const booksToFix = await Book.findAll({
        where: {
            isbn: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
            // Aggressive mode: We include ALL books with ISBNs to allow for refreshing metadata/images
        },
        attributes: ['id', 'isbn', 'author', 'description', 'imageUrl'],
        raw: true
    });

    if (booksToFix.length === 0) {
        console.log('[Phase 2] All books are already enriched. Skipping.');
        return;
    }

    const isbnMap = new Map();
    booksToFix.forEach(b => {
        const clean = b.isbn.replace(/[-\s]/g, '');
        isbnMap.set(clean, {
            id: b.id,
            isbn: clean,
            needsAuthor: !b.author || b.author === 'Unknown',
            needsDesc: !b.description || b.description === 'No description available.',
            currentImage: b.imageUrl
        });
    });

    const totalBooksInLibrary = await Book.count();
    const alreadyFixed = totalBooksInLibrary - isbnMap.size;

    console.log(`[Phase 2] Library Status: ${totalBooksInLibrary.toLocaleString()} total books.`);
    console.log(`[Phase 2] Current Progress: ${alreadyFixed.toLocaleString()} enriched, ${isbnMap.size.toLocaleString()} still need repair.`);
    console.log(`[Phase 2] Matching against dump: ${path.basename(activePath)}...`);

    // 3. Stream the Dump File
    const fileStream = fs.createReadStream(activePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let lineCount = 0;
    let seasonalFixed = 0; // Fixed in this session
    let batchUpdates = [];
    const startTime = Date.now();

    for await (const line of rl) {
        lineCount++;
        if (lineCount <= progress.repairLine) continue;

        const parts = line.split('\t');
        if (parts.length < 5) continue;

        try {
            const data = JSON.parse(parts[4]);
            const isbns = [...(data.isbn_13 || []), ...(data.isbn_10 || [])];

            let match = null;
            for (let isbn of isbns) {
                const clean = isbn.replace(/[-\s]/g, '');
                if (isbnMap.has(clean)) {
                    match = isbnMap.get(clean);
                    break;
                }
            }

            if (match) {
                const updateData = {};
                let updated = false;

                if (match.needsAuthor) {
                    // 1. Try to get Author Keys first (High Quality)
                    if (data.authors && Array.isArray(data.authors)) {
                        updateData.authorKeys = data.authors
                            .map(a => a.key ? a.key.replace('/authors/', '') : null)
                            .filter(k => k);
                    }

                    // 2. Fallback to by_statement
                    if (data.by_statement) {
                        updateData.authorFallback = data.by_statement;
                    }

                    // We mark as updated if we have EITHER keys or a fallback
                    if ((updateData.authorKeys && updateData.authorKeys.length > 0) || updateData.authorFallback) {
                        updated = true;
                    }
                }
                if (match.needsDesc && data.description) {
                    updateData.description = typeof data.description === 'string' ? data.description : data.description.value;
                    updated = true;
                }
                // Aggressive Image Update: If dump has a cover, we take it if it's new
                let dumpImg = null;
                if (data.covers && data.covers[0] > 0) dumpImg = `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`;
                else dumpImg = `https://covers.openlibrary.org/b/isbn/${match.isbn}-L.jpg`;

                if (dumpImg && dumpImg !== match.currentImage) {
                    updateData.imageUrl = dumpImg;
                    updated = true;
                }

                if (data.subjects && data.subjects.length > 0) {
                    updateData.mappedCategories = data.subjects.slice(0, 10);
                    updated = true;
                }

                if (updated) {
                    batchUpdates.push({ id: match.id, ...updateData });
                }
            }
        } catch (e) { }

        if (batchUpdates.length >= 100) {
            seasonalFixed += await processBatchUpdates(batchUpdates);
            batchUpdates = [];
            progress.repairLine = lineCount;
            saveProgress(progress);

            // Log every 500 fixed records as requested
            const totalFixedOverall = alreadyFixed + seasonalFixed;
            if (seasonalFixed > 0 && seasonalFixed % 500 === 0) {
                const elapsed = (Date.now() - startTime) / 1000;
                const sessionRecPerSec = seasonalFixed / elapsed;
                const remainingToFix = isbnMap.size - seasonalFixed;
                const etaSeconds = remainingToFix / (sessionRecPerSec || 1);
                const etaMin = (etaSeconds / 60).toFixed(1);

                console.log(`  [Enrichment] Progress: ${totalFixedOverall.toLocaleString()} / ${totalBooksInLibrary.toLocaleString()} (${((totalFixedOverall / totalBooksInLibrary) * 100).toFixed(1)}%) | Rate: ${sessionRecPerSec.toFixed(1)} rec/s | ETA: ${etaMin}m`);
            }
        }

        // Also log every 100,000 lines scanned to show it's still moving
        if (lineCount % 100000 === 0) {
            console.log(`  [Scanner] Scanned ${lineCount.toLocaleString()} OL dump records...`);
        }
    }

    if (batchUpdates.length > 0) {
        seasonalFixed += await processBatchUpdates(batchUpdates);
    }
    console.log(`[Phase 2] Complete. Enriched ${seasonalFixed.toLocaleString()} books in this session.`);
}

async function processBatchUpdates(updates) {
    // 1. Load Curated Categories & Triggers
    const curatedCategories = await Category.findAll({
        where: { subject_triggers: { [Op.ne]: null } }
    });

    // Fallback: Ensure we have "New Books"
    let [defaultCat] = await Category.findOrCreate({ where: { name: 'New Books' } });

    // --- BATCH AUTHOR RESOLUTION ---
    // Collect all author keys from the batch
    const allAuthorKeys = new Set();
    updates.forEach(u => {
        if (u.authorKeys) u.authorKeys.forEach(k => allAuthorKeys.add(k));
    });

    // Fetch names from DB
    const authorMap = new Map(); // ID -> Name
    if (allAuthorKeys.size > 0) {
        const dbAuthors = await OpenLibraryAuthor.findAll({
            where: { author_id: { [Op.in]: [...allAuthorKeys] } },
            attributes: ['author_id', 'name'],
            raw: true
        });
        dbAuthors.forEach(a => authorMap.set(a.author_id, a.name));
    }
    // -------------------------------

    await sequelize.transaction(async (t) => {
        for (const item of updates) {
            const { id, mappedCategories, authorKeys, authorFallback, ...rest } = item;
            let bookData = { ...rest };

            // Resolve Author Name
            if (authorKeys && authorKeys.length > 0) {
                const resolvedNames = authorKeys
                    .map(k => authorMap.get(k))
                    .filter(n => n); // Only keep found names

                if (resolvedNames.length > 0) {
                    bookData.author = resolvedNames.join(', ');
                } else if (authorFallback) {
                    bookData.author = authorFallback; // Fallback if DB lookup failed
                }
            } else if (authorFallback) {
                bookData.author = authorFallback;
            }

            if (bookData.title) bookData.title = bookData.title.substring(0, 255);
            if (bookData.author) bookData.author = (bookData.author || '').substring(0, 2000);
            if (bookData.imageUrl) bookData.imageUrl = (bookData.imageUrl || '').substring(0, 255);
            if (bookData.description) bookData.description = (bookData.description || '').substring(0, 4000);

            // Enforce visibility
            const hasDescription = bookData.description && bookData.description.trim() !== '' && bookData.description !== 'No description available.';
            const hasAuthor = bookData.author && bookData.author !== 'Unknown' && bookData.author.trim() !== '';

            if (hasDescription && hasAuthor) {
                bookData.isVisible = true;
            } else {
                bookData.isVisible = false;
            }

            await Book.update(bookData, { where: { id }, transaction: t });

            if (mappedCategories && mappedCategories.length > 0) {
                const categoryIds = new Set();

                // Map each subject string to our curated triggers
                for (const subject of mappedCategories) {
                    const cleanSubject = subject.toLowerCase();
                    for (const cat of curatedCategories) {
                        const triggers = cat.subject_triggers.split(',').map(tr => tr.trim().toLowerCase());
                        if (triggers.some(tr => cleanSubject.includes(tr))) {
                            categoryIds.add(cat.id);
                        }
                    }
                }

                // If no trigger matches, use "New Books"
                if (categoryIds.size === 0) {
                    categoryIds.add(defaultCat.id);
                }

                if (categoryIds.size > 0) {
                    const mappings = [...categoryIds].map(catId => ({ BookId: id, CategoryId: catId }));
                    await BookCategory.bulkCreate(mappings, { transaction: t, ignoreDuplicates: true });
                }
            }
        }
    });
    return updates.length;
}

async function runDeepRepairPhase(progress) {
    console.log('\n--- PHASE 3: DEEP AUTHOR REPAIR (SPECIFIC FIELD EXTRACTION) ---');

    const activePath = DUMP_PATHS.find(p => fs.existsSync(p));
    if (!activePath) {
        console.log('[Phase 3] WARNING: No dump file found. Skipping.');
        return;
    }

    console.log('[Phase 3] Building cross-reference map for books missing authors...');
    const booksToFix = await Book.findAll({
        where: {
            isbn: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
            [Op.or]: [{ author: null }, { author: '' }, { author: 'Unknown' }]
        },
        attributes: ['id', 'isbn'],
        raw: true
    });

    if (booksToFix.length === 0) {
        console.log('[Phase 3] No books missing authors. Skipping.');
        return;
    }

    const isbnMap = new Map();
    booksToFix.forEach(b => {
        const clean = b.isbn.replace(/[-\s]/g, '');
        isbnMap.set(clean, b.id);
    });

    console.log(`[Phase 3] Targeted ${isbnMap.size.toLocaleString()} books for deep author repair.`);

    const fileStream = fs.createReadStream(activePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let lineCount = 0;
    let fixedCount = 0;
    let batchUpdates = [];
    const startTime = Date.now();
    const TOTAL_ESTIMATED_LINES = 55654833;

    for await (const line of rl) {
        lineCount++;
        if (lineCount <= progress.deepRepairLine) continue;

        const parts = line.split('\t');
        if (parts.length < 5) continue;

        try {
            const data = JSON.parse(parts[4]);
            const isbns = [...(data.isbn_13 || []), ...(data.isbn_10 || [])];

            let matchedId = null;
            let matchedIsbn = null;
            for (let isbn of isbns) {
                const clean = isbn.replace(/[-\s]/g, '');
                if (isbnMap.has(clean)) {
                    matchedId = isbnMap.get(clean);
                    matchedIsbn = clean;
                    break;
                }
            }

            if (matchedId && data.by_statement) {
                let authorName = data.by_statement.trim();
                if (authorName.toLowerCase().startsWith("by ")) authorName = authorName.substring(3).trim();

                if (authorName) {
                    batchUpdates.push({ id: matchedId, author: authorName.substring(0, 2000) });
                    isbnMap.delete(matchedIsbn); // One fix per book
                }
            }
        } catch (e) { }

        if (batchUpdates.length >= 200) {
            fixedCount += await processBatchUpdates(batchUpdates);
            batchUpdates = [];
            progress.deepRepairLine = lineCount;
            saveProgress(progress);

            if (fixedCount % 1000 === 0) {
                const elapsed = (Date.now() - startTime) / 1000;
                console.log(`  [Deep Repair] Fixed: ${fixedCount.toLocaleString()} authors | Progress: ${((lineCount / TOTAL_ESTIMATED_LINES) * 100).toFixed(1)}% | Rate: ${(fixedCount / elapsed).toFixed(1)} fixed/s`);
            }
        }

        if (lineCount % 500000 === 0) {
            console.log(`  [Scanner] Scanned ${lineCount.toLocaleString()} lines...`);
        }

        if (isbnMap.size === 0) break;
    }

    if (batchUpdates.length > 0) {
        fixedCount += await processBatchUpdates(batchUpdates);
    }
    console.log(`[Phase 3] Complete. Locally resolved and fixed ${fixedCount.toLocaleString()} authors.`);
}

function saveProgress(p) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p), 'utf8');
}

migrate();
