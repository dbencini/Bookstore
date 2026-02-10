const { sequelize, Job } = require('./models');

async function checkJobStatus() {
    try {
        await sequelize.authenticate();

        const jobs = await Job.findAll({
            where: { type: 'author_repair_local' },
            order: [['id', 'DESC']],
            limit: 5,
            attributes: ['id', 'type', 'status', 'progress', 'summary', 'startTime', 'endTime']
        });

        console.log('\n=== Recent Author Repair Jobs ===\n');
        jobs.forEach(job => {
            console.log(`Job ${job.id}:`);
            console.log(`  Status: ${job.status}`);
            console.log(`  Progress: ${job.progress}%`);
            console.log(`  Summary: ${job.summary}`);
            console.log(`  Started: ${job.startTime}`);
            console.log(`  Ended: ${job.endTime || 'Still running'}`);
            console.log('');
        });

        await sequelize.close();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkJobStatus();
