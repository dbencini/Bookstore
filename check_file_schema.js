const { sequelize } = require('./models');

async function checkSchema() {
    try {
        await sequelize.authenticate();
        const [results] = await sequelize.query("PRAGMA table_info(cp_files);");
        console.log('Columns:', results.map(r => r.name));
    } catch (err) {
        console.error(err);
    } finally {
        await sequelize.close();
    }
}
checkSchema();
