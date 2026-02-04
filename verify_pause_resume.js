const { Book, Job, Category } = require('./models');
const { fixBookData, pauseJob, resumeJob, stopJob } = require('./services/bookService');
const sequelize = require('./config/database');

async function verifyPauseResume() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // 1. Create a category
        let [cat] = await Category.findOrCreate({ where: { name: 'Pause Test' } });

        // 2. Create 10 test books
        console.log('Creating 10 test books...');
        const uniqueId = Date.now();
        for (let i = 0; i < 10; i++) {
            await Book.create({
                title: `Pause Test Book ${i} ${uniqueId}`,
                author: 'Unknown',
                isbn: `PAUSE${uniqueId}${i}`,
                description: '',
                price: 10.00,
                stock: 1,
                categoryId: cat.id
            });
        }

        // 3. Start Repair
        console.log('Starting Repair Job...');
        const startResult = await fixBookData();
        const jobId = startResult.jobId;

        // 4. Wait for ACTUAL progress (not just starting)
        console.log('Waiting for processing to begin...');
        let job = await Job.findByPk(jobId);
        let waitAttempts = 0;
        while (job.processedCount === 0 && waitAttempts < 60) {
            waitAttempts++;
            await new Promise(r => setTimeout(r, 2000));
            job = await Job.findByPk(jobId);
            if (waitAttempts % 5 === 0) console.log(`Still waiting... (Status: ${job.status}, Summary: ${job.summary})`);
        }

        if (job.processedCount === 0) {
            console.log('Timeout waiting for job to start processing.');
            await stopJob(jobId);
            process.exit(1);
        }

        console.log('Pausing Job...');
        await pauseJob(jobId);

        await new Promise(r => setTimeout(r, 2000));
        job = await Job.findByPk(jobId);
        console.log(`[PAUSED] Status: ${job.status} | Processed: ${job.processedCount} | Last ID: ${job.lastProcessedId}`);
        const pausedAt = job.processedCount;

        // 5. Resume
        console.log('Resuming Job...');
        await resumeJob(jobId);

        // 6. Poll for more progress
        let progressMoved = false;
        let resumeAttempts = 0;
        while (!progressMoved && resumeAttempts < 30) {
            resumeAttempts++;
            await new Promise(r => setTimeout(r, 5000));
            job = await Job.findByPk(jobId);
            console.log(`[RESUMED] Status: ${job.status} | Processed: ${job.processedCount}`);
            if (job.processedCount > pausedAt) {
                progressMoved = true;
                console.log('SUCCESS: Progress moved after resume!');
            }
        }

        // 7. Stop Job
        console.log('Stopping Job...');
        await stopJob(jobId);
        job = await Job.findByPk(jobId);
        console.log(`[STOPPED] Status: ${job.status}`);

        if (progressMoved) {
            console.log('\nVERIFICATION PASSED: Job state was persisted and resumed.');
        } else {
            console.log('\nVERIFICATION FAILED: Progress did not move after resume.');
        }

    } catch (err) {
        console.error('Verification failed:', err);
    } finally {
        process.exit();
    }
}

verifyPauseResume();
