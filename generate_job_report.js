const { Job, Book, sequelize } = require('./models');

async function run() {
    try {
        const count = await Book.count();
        const jobs = await Job.findAll({ order: [['createdAt', 'DESC']] });

        console.log('--- DATABASE REPORT ---');
        console.log('Total Books:', count.toLocaleString());
        console.log('\n--- JOB HISTORY ---');

        jobs.forEach(j => {
            console.log(`ID: ${j.id}`);
            console.log(`Type: ${j.type}`);
            console.log(`Status: ${j.status}`);
            console.log(`Summary: ${j.summary}`);
            console.log(`Processed: ${j.processedCount?.toLocaleString() || 0}`);
            console.log(`Added: ${j.booksAdded?.toLocaleString() || 0}`);
            console.log(`Fixed: ${j.fixedCount?.toLocaleString() || 0}`);
            console.log('-----------------------------');
        });

        await sequelize.close();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
