// Quick check of mapping table progress
require('dotenv').config();
const { sequelize } = require('./models');

async function checkProgress() {
    try {
        const [result] = await sequelize.query('SELECT COUNT(*) as count FROM isbn_author_mappings');
        console.log(`Current mappings in table: ${result[0].count.toLocaleString()}`);

        if (result[0].count === 0) {
            console.log('\n⚠️  No mappings inserted yet! The process may be stuck or running very slowly.');
        } else {
            console.log(`✅ Progress is being made. ${result[0].count} mappings created so far.`);
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await sequelize.close();
    }
}

checkProgress();
