const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Book, Job, Category, sequelize } = require('./models');
const { startUltimateRepair } = require('./services/bookService');

async function verifyUltimateRepair() {
    console.log('--- Starting Ultimate Repair Verification ---');
    const dumpPath = path.join(__dirname, 'uploads/ol_dump_editions.txt.gz');

    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // 1. Prepare Mock Data
        console.log('Creating mock Open Library dump...');
        const mockData = [
            `type\tkey\trevision\tlast_modified\t${JSON.stringify({
                isbn_13: ['9780000000001'],
                authors: [{}],
                description: 'This is a verified description from Open Library.',
                by_statement: 'Verified Author'
            })}`,
            `type\tkey\trevision\tlast_modified\t${JSON.stringify({
                isbn_10: ['0000000002'],
                authors: [{}],
                description: { type: '/type/text', value: 'This is a nested verified description.' },
                by_statement: 'Another Verified Author'
            })}`
        ].join('\n');

        const buffer = zlib.gzipSync(Buffer.from(mockData));
        if (!fs.existsSync(path.dirname(dumpPath))) fs.mkdirSync(path.dirname(dumpPath), { recursive: true });
        fs.writeFileSync(dumpPath, buffer);
        console.log(`Mock dump created at ${dumpPath}`);

        // 2. Prepare Database Records
        console.log('Cleaning up and creating test books...');
        await Book.destroy({ where: { title: { [require('sequelize').Op.like]: 'Ultimate Test%' } } });

        const [cat] = await Category.findOrCreate({ where: { name: 'Ultimate Test' } });

        await Book.create({
            title: 'Ultimate Test Book 1',
            author: 'Unknown',
            isbn: '9780000000001',
            description: 'No description available.',
            price: 100,
            stock: 10,
            categoryId: cat.id,
            isVisible: true
        });

        await Book.create({
            title: 'Ultimate Test Book 2',
            author: 'Unknown',
            isbn: '0000000002',
            description: '',
            price: 50,
            stock: 5,
            categoryId: cat.id,
            isVisible: true
        });

        // Cleanup existing jobs to avoid "job already running" error
        await Job.update({ status: 'stopped' }, {
            where: { type: 'ultimate_repair', status: 'running' }
        });

        // 3. Trigger Repair
        console.log('Triggering Ultimate Repair...');
        const result = await startUltimateRepair();

        if (!result || typeof result.success === 'undefined') {
            console.error('CRITICAL: result is invalid:', result);
            process.exit(1);
        }

        if (!result.success) {
            console.warn('Job start failed (likely already running):', result.message);
            // Try to find the existing job to monitor it anyway? or just fail.
            // For verification, we want a clean start.
            throw new Error(result.message);
        }

        const jobId = result.jobId;
        console.log(`Job started: ${jobId}`);

        // 4. Poll Progress
        let attempts = 0;
        let success = false;
        while (attempts < 20) {
            attempts++;
            await new Promise(r => setTimeout(r, 2000));
            const job = await Job.findByPk(jobId);
            console.log(`[Job ${job.id}] Status: ${job.status} | Summary: ${job.summary} | Fixed: ${job.fixedCount}`);

            if (job.status === 'completed') {
                if (job.fixedCount === 2) {
                    success = true;
                }
                break;
            }
            if (job.status === 'failed') break;
        }

        // 5. Final Verification
        if (success) {
            const b1 = await Book.findOne({ where: { isbn: '9780000000001' } });
            const b2 = await Book.findOne({ where: { isbn: '0000000002' } });

            const desc1Match = b1.description === 'This is a verified description from Open Library.';
            const author1Match = b1.author === 'Verified Author';
            const desc2Match = b2.description === 'This is a nested verified description.';
            const author2Match = b2.author === 'Another Verified Author';

            if (desc1Match && author1Match && desc2Match && author2Match) {
                console.log('\nVERIFICATION PASSED: All books enriched correctly.');
            } else {
                console.log('\nVERIFICATION FAILED: Data mismatch.');
                console.log('Book 1:', { desc: b1.description, author: b1.author });
                console.log('Book 2:', { desc: b2.description, author: b2.author });
            }
        } else {
            console.log('\nVERIFICATION FAILED: Job did not complete successfully or match count wrong.');
        }

    } catch (err) {
        console.error('Verification Error:', err);
    } finally {
        console.log('Verification finished. Check logs above.');
        // Don't cleanup yet to inspect
        // if (fs.existsSync(dumpPath)) fs.unlinkSync(dumpPath);
        process.exit();
    }
}

verifyUltimateRepair();
