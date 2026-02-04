const { Book, Job, Category } = require('./models');
const { fixBookData, stopJob } = require('./services/bookService');
const sequelize = require('./config/database');
const { Op } = require('sequelize');

async function verifyRefinedRepair() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // 1. Cleanup
        await Book.destroy({ where: { title: { [Op.like]: 'Refined Test%' } } });

        // 2. Create a category
        let [cat] = await Category.findOrCreate({ where: { name: 'Refined Test' } });

        // 3. Create test books with different stock and ISBN status
        console.log('Creating test books...');
        const uniqueId = Date.now();

        // Should be ignored (no ISBN)
        await Book.create({
            title: `Refined Test No ISBN ${uniqueId}`,
            author: 'Unknown',
            isbn: null,
            description: '',
            price: 10.00,
            stock: 100,
            categoryId: cat.id
        });

        // Should be second (Stock 50)
        await Book.create({
            title: `Refined Test Mid Stock ${uniqueId}`,
            author: 'Unknown',
            isbn: `TESTISBN${uniqueId}B`,
            description: '',
            price: 15.00,
            stock: 50,
            categoryId: cat.id
        });

        // Should be first (Stock 500)
        await Book.create({
            title: `Refined Test High Stock ${uniqueId}`,
            author: 'Unknown',
            isbn: `TESTISBN${uniqueId}A`,
            description: '',
            price: 20.00,
            stock: 500,
            categoryId: cat.id
        });

        // 4. Start Repair
        console.log('Starting Refined Repair Job...');
        const startResult = await fixBookData();
        const jobId = startResult.jobId;

        // 5. Monitor and verify
        console.log('Monitoring job...');
        let job = await Job.findByPk(jobId);
        let attempts = 0;
        let success = false;

        while (attempts < 30) {
            attempts++;
            await new Promise(r => setTimeout(r, 5000));
            job = await Job.findByPk(jobId);
            console.log(`[Job ${job.id}] Status: ${job.status} | Progress: ${job.progress} | Summary: ${job.summary}`);

            // We check server logs manually for order, but here we can check if only 2 were identified
            if (job.summary.includes('Identified 2 books with ISBNs')) {
                console.log('SUCCESS: Identified only books with ISBNs.');
                success = true;
                break;
            }

            if (job.status === 'failed') {
                console.log('Job failed.');
                break;
            }
        }

        // 6. Stop
        await stopJob(jobId);
        console.log('Job stopped.');

        if (success) {
            console.log('\nVERIFICATION PASSED: Logic refined successfully.');
        } else {
            console.log('\nVERIFICATION FAILED: Did not correctly identify ISBN-only books.');
        }

    } catch (err) {
        console.error('Verification failed:', err);
    } finally {
        process.exit();
    }
}

verifyRefinedRepair();
