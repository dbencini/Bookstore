const fs = require('fs');
const path = require('path');
const { Book, Job, sequelize } = require('./models');
const { Op } = require('sequelize');

async function runDeepRepair() {
    const dumpPath = path.join(__dirname, 'uploads/GoogleHugeFile.txt');
    if (!fs.existsSync(dumpPath)) {
        console.error("Critical: GoogleHugeFile.txt not found in uploads.");
        process.exit(1);
    }

    console.log("--- STARTING DEEP AUTHOR REPAIR (BY_STATEMENT PASS) ---");

    // 0. LOAD TARGET ISBNS
    console.log("[Setup] Loading target ISBNs from database...");
    const targetBooks = await Book.findAll({
        where: {
            [Op.or]: [{ author: null }, { author: '' }, { author: 'Unknown' }],
            isbn: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
        },
        attributes: ['id', 'isbn'],
        raw: true
    });

    const isbnMap = new Map();
    targetBooks.forEach(b => {
        const clean = b.isbn.replace(/[-\s]/g, '');
        isbnMap.set(clean, b.id);
    });

    console.log(`[Setup] Targeted ${isbnMap.size.toLocaleString()} unique books needing authors.`);

    const job = await Job.create({
        type: 'deep_author_repair',
        summary: "Scanning local Editions dump for 'by_statement' matches...",
        startTime: new Date(),
        status: 'running',
        progress: 0
    });

    const fileHandle = fs.openSync(dumpPath, 'r');
    const bufferSize = 4 * 1024 * 1024; // 4MB chunks for speed
    const buffer = Buffer.alloc(bufferSize);

    let bytesRead;
    let currentLine = "";
    let scannedLines = 0;
    let fixedCount = 0;
    let updates = [];
    const TOTAL_ESTIMATED_LINES = 55654833;

    while ((bytesRead = fs.readSync(fileHandle, buffer, 0, bufferSize)) > 0) {
        let content = buffer.toString('utf8', 0, bytesRead);
        let lines = (currentLine + content).split('\n');
        currentLine = lines.pop();

        for (const line of lines) {
            scannedLines++;
            if (line.startsWith('/type/edition')) {
                const parts = line.split('\t');
                if (parts.length >= 5) {
                    try {
                        const data = JSON.parse(parts[4]);

                        // Extract ISBNs
                        const isbns = [
                            ...(data.isbn_10 || []),
                            ...(data.isbn_13 || [])
                        ].map(i => i.replace(/[-\s]/g, ''));

                        // Match ISBN
                        const matchedIsbn = isbns.find(i => isbnMap.has(i));
                        if (matchedIsbn) {
                            const bookId = isbnMap.get(matchedIsbn);

                            // Extract Author from by_statement
                            if (data.by_statement) {
                                let authorName = data.by_statement.trim();
                                // Basic cleanup: some statements include prefixes like "by "
                                if (authorName.toLowerCase().startsWith("by ")) {
                                    authorName = authorName.substring(3).trim();
                                }

                                if (authorName && authorName.length > 0) {
                                    // Truncate to 255 to fit DB column
                                    authorName = authorName.substring(0, 255);
                                    updates.push({ id: bookId, author: authorName });
                                    fixedCount++;
                                    isbnMap.delete(matchedIsbn);
                                }
                            }
                        }
                    } catch (e) { }
                }
            }

            if (updates.length >= 500) {
                await performBatchUpdate(updates);
                updates = [];
                job.summary = `Fixed ${fixedCount.toLocaleString()} authors so far.`;
                job.progress = Math.min(99, Math.floor((scannedLines / TOTAL_ESTIMATED_LINES) * 100));
                await job.save();
                process.stdout.write(`\rFixed ${fixedCount.toLocaleString()} authors... (${scannedLines.toLocaleString()} / ${TOTAL_ESTIMATED_LINES.toLocaleString()} lines)`);
            }
        }
        if (isbnMap.size === 0) break;
    }

    if (updates.length > 0) await performBatchUpdate(updates);

    fs.closeSync(fileHandle);

    job.status = 'completed';
    job.progress = 100;
    job.summary = `Deep repair complete! Locally resolved and fixed ${fixedCount.toLocaleString()} authors using local metadata.`;
    job.endTime = new Date();
    await job.save();

    console.log(`\n\n--- DEEP REPAIR COMPLETE ---`);
    console.log(`Resolved: ${fixedCount.toLocaleString()}`);
    console.log(`Remaining targets: ${isbnMap.size.toLocaleString()}`);
    process.exit(0);
}

async function performBatchUpdate(updates) {
    try {
        await sequelize.transaction(async (t) => {
            for (const update of updates) {
                await Book.update({ author: update.author }, {
                    where: { id: update.id },
                    transaction: t
                });
            }
        });
    } catch (err) {
        console.error("Batch update error:", err.message);
    }
}

runDeepRepair().catch(console.error);
