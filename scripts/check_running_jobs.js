require('dotenv').config();
const { sequelize, Job } = require('../models');

async function listJobs() {
    try {
        const runningJobs = await Job.findAll({
            where: { status: 'running' },
            attributes: ['id', 'type', 'startTime', 'updatedAt']
        });

        console.log(JSON.stringify(runningJobs, null, 2));

    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        await sequelize.close();
    }
}

listJobs();
