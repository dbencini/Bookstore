const { Book, Job, Category } = require('./models');
const { fixBookData, cancelJob } = require('./services/bookService');
const sequelize = require('./config/database');

async function verifyRepair() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // 1. Create a category if needed
        let [cat] = await Category.findOrCreate({ where: { name: 'Repair Test' } });

        // 2. Create "Bad" Books with UNIQUE Titles/ISBNs
        console.log('Creating test books with missing data...');
        const uniqueId = Date.now();
        const testBooks = [
            {
                title: `Repair Test Gatsby ${uniqueId}`,
                author: 'Unknown',
                isbn: `TEST${uniqueId}`,
                description: '',
                price: 10.99,
                stock: 10,
                imageUrl: 'https://placehold.co/200x300?text=Gatsby',
                categoryId: cat.id
            },
            {
                title: `Repair Test 1984 ${uniqueId}`,
                author: 'George Orwell',
                isbn: null,
                description: 'No description available.',
                price: 12.99,
                stock: 5,
                imageUrl: 'https://placehold.co/200x300?text=1984',
                categoryId: cat.id
            }
        ];

        for (const b of testBooks) {
            await Book.create(b);
        }

        // 3. Start Repair
        console.log('Triggering data repair job...');
        const result = await fixBookData();
        const jobId = result.jobId;
        console.log('Repair Job Started. ID:', jobId);

        // 4. Poll until MY books are fixed or job ends
        let finished = false;
        let attempts = 0;
        while (!finished && attempts < 100) {
            attempts++;
            const job = await Job.findByPk(jobId);
            console.log(`[Job ${jobId}] Status: ${job.status} | Progress: ${job.progress}% | Summary: ${job.summary}`);

            const repairedBooks = await Book.findAll({
                where: { title: [`Repair Test Gatsby ${uniqueId}`, `Repair Test 1984 ${uniqueId}`] }
            });

            const allFixed = repairedBooks.every(b =>
                b.description && b.description !== '' && b.description !== 'No description available.' &&
                !b.imageUrl.includes('placehold.co')
            );

            if (allFixed) {
                console.log('SUCCESS: Both test books have been repaired!');
                finished = true;
            } else if (job.status !== 'running') {
                console.log('Job stopped unexpectedly.');
                finished = true;
            } else {
                console.log('Still waiting for repair...');
                await new Promise(r => setTimeout(r, 10000));
            }
        }

        // 5. Cancel Job (no need to run for millions of books in this test)
        console.log('Cancelling the long-running job...');
        await cancelJob(jobId);

        // Final Report
        const finalBooks = await Book.findAll({
            where: { title: [`Repair Test Gatsby ${uniqueId}`, `Repair Test 1984 ${uniqueId}`] }
        });

        console.log('\n--- Final Validation ---');
        finalBooks.forEach(b => {
            console.log(`Book: "${b.title}"`);
            console.log(`  Author: ${b.author}`);
            console.log(`  ISBN: ${b.isbn}`);
            console.log(`  Description: ${b.description ? b.description.substring(0, 50) + '...' : 'NONE'}`);
            console.log(`  Image: ${b.imageUrl}`);
            console.log('-------------------------');
        });

    } catch (err) {
        console.error('Verification failed:', err);
    } finally {
        process.exit();
    }
}

verifyRepair();
