require('dotenv').config();
const { sequelize } = require('./models');

async function check() {
    try {
        const [r] = await sequelize.query('SHOW FULL PROCESSLIST');
        const found = r.filter(p => p.Info && p.Info.toLowerCase().includes('alter'));
        if (found.length > 0) {
            found.forEach(p => {
                console.log(`STATUS: [${p.Id}] [${p.State}] [${p.Time}s]`);
            });
        } else {
            console.log('STATUS: [NO_PROCESS_FOUND] [0s]');
        }
    } catch (err) {
        console.error(err);
    } finally {
        await sequelize.close();
    }
}

check();
