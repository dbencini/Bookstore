// Check for and kill MySQL locks
require('dotenv').config();
const { sequelize } = require('./models');

async function checkLocks() {
    console.log('Checking for MySQL locks...\n');

    try {
        // Show running processes
        const [processes] = await sequelize.query(`
            SELECT ID, USER, HOST, DB, COMMAND, TIME, STATE, INFO 
            FROM information_schema.PROCESSLIST 
            WHERE DB = '${process.env.DB_NAME}'
            AND COMMAND != 'Sleep'
            ORDER BY TIME DESC
        `);

        console.log('Active processes:');
        processes.forEach(p => {
            console.log(`ID: ${p.ID}, User: ${p.USER}, Time: ${p.TIME}s, State: ${p.STATE}`);
            console.log(`Query: ${p.INFO}\n`);
        });

        // Show locks
        const [locks] = await sequelize.query(`
            SELECT * FROM information_schema.INNODB_LOCKS
        `);

        if (locks.length > 0) {
            console.log('Found locks:');
            console.log(locks);
        } else {
            console.log('No locks found');
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await sequelize.close();
    }
}

checkLocks()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
