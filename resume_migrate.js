const { sequelize, Book, Subject, BookSubject, Job, Op } = require('./models');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');

// --- CONFIGURATION ---
const CSV_PATH = path.join(__dirname, 'uploads', 'POD_Library.csv');
const DUMP_PATHS = [
    path.join(__dirname, 'uploads', 'GoogleHugeFile.txt'),
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

    // Warm up Subject Cache
    const existingSubs = await Subject.findAll();
    const subjectMap = {};
    existingSubs.forEach(s => subjectMap[s.name] = s.id);

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

        const subName = row.category || 'New Books';
        if (!subjectMap[subName]) {
            const [newSub] = await Subject.findOrCreate({ where: { name: subName } });
            subjectMap[subName] = newSub.id;
        }

        const cost = parseFloat(row.price_cost || row.cost || row.price) || 0;

        batch.push({
            title: title || 'Unknown Title',
            author: row.author || 'Unknown',
            description: row.description || 'No description available.',
            price: cost || 19.99,
            price_cost: cost,
            imageUrl: row.imageurl || '/images/default_cover.svg',
            isbn: isbn || null,
            status: 'ready',
            bind: bind || null,
            isVisible: true,
            import_comment: importComment,
            subjectIdsJson: [subjectMap[subName]],
            createdAt: new Date(),
            updatedAt: new Date()
        });

        if (batch.length >= BATCH_SIZE) {
            await Book.bulkCreate(batch, { ignoreDuplicates: true });
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
        console.log('[Phase 2] WARNING: No Open Library dump found (GoogleHugeFile.txt). Skipping Enrichment Phase.');
        return;
    }
    console.log(`[Phase 2] Using dump: ${path.basename(activePath)}`);

    // 2. Index ISBNs that still need fixing
    console.log('[Phase 2] Indexing books that need Author/Desc/Image repair...');
    const booksToFix = await Book.findAll({
        where: {
            isbn: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
            [Op.or]: [
                { author: { [Op.or]: [null, '', 'Unknown'] } },
                { description: { [Op.or]: [null, '', 'No description available.'] } },
                { imageUrl: { [Op.or]: [null, '', { [Op.like]: '%placehold.co%' }, { [Op.like]: '%default_cover.svg%' }] } }
            ]
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
            needsImage: !b.imageUrl || b.imageUrl.includes('default_cover.svg') || b.imageUrl.includes('placehold.co')
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

                if (match.needsAuthor && data.by_statement) {
                    updateData.author = data.by_statement;
                    updated = true;
                }
                if (match.needsDesc && data.description) {
                    updateData.description = typeof data.description === 'string' ? data.description : data.description.value;
                    updated = true;
                }
                if (match.needsImage) {
                    let img = null;
                    if (data.covers && data.covers[0] > 0) img = `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`;
                    else img = `https://covers.openlibrary.org/b/isbn/${match.isbn}-L.jpg`;

                    if (img) {
                        updateData.imageUrl = img;
                        updated = true;
                    }
                }

                if (data.subjects) {
                    updateData.subjects = data.subjects.slice(0, 5);
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
    const subjectsToEnsure = new Set();
    for (const item of updates) {
        if (item.subjects) {
            item.subjects.forEach(s => {
                const parts = s.split(';').map(p => p.trim().substring(0, 255)).filter(Boolean);
                parts.forEach(p => subjectsToEnsure.add(p));
            });
        }
    }

    const subjectMap = {};
    for (const name of subjectsToEnsure) {
        const [sub] = await Subject.findOrCreate({ where: { name } });
        subjectMap[name] = sub.id;
    }

    await sequelize.transaction(async (t) => {
        for (const item of updates) {
            const { id, subjects, ...bookData } = item;
            if (bookData.title) bookData.title = bookData.title.substring(0, 255);
            if (bookData.author) bookData.author = bookData.author.substring(0, 255);
            if (bookData.imageUrl) bookData.imageUrl = bookData.imageUrl.substring(0, 255);
            if (bookData.description) bookData.description = bookData.description.substring(0, 4000);

            await Book.update(bookData, { where: { id }, transaction: t });

            if (subjects && subjects.length > 0) {
                const subjectIds = subjects.map(s => subjectMap[s.split(';')[0].trim().substring(0, 255)]).filter(Boolean);
                if (subjectIds.length > 0) {
                    await Book.update({ subjectIdsJson: subjectIds }, { where: { id }, transaction: t });
                    const mappings = subjectIds.map(subId => ({ BookId: id, SubjectId: subId }));
                    await BookSubject.bulkCreate(mappings, { transaction: t, ignoreDuplicates: true });
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
                    batchUpdates.push({ id: matchedId, author: authorName.substring(0, 255) });
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
