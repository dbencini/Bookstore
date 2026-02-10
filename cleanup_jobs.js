const { Job } = require('./models');
const { Op } = require('sequelize');

async function cleanup() {
    try {
        console.log('Cleaning up ghost jobs...');
        const result = await Job.update(
            { status: 'stopped', summary: 'Stopped by maintenance script' },
            {
                where: {
                    status: 'running',
                    type: 'author_repair_stable',
                    startTime: { [Op.lt]: new Date(Date.now() - 5 * 60 * 1000) } // Older than 5 mins
                }
            }
        );
        console.log(`Updated ${result[0]} stalled jobs.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

cleanup();
