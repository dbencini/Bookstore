const { sequelize } = require('./models');

async function verifyTables() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        // await sequelize.sync(); // Ensure sync happens if server didn't run

        const [results, metadata] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cp_%';");

        console.log('CloudPrinter Tables found:');
        if (results.length === 0) {
            console.log('No tables found starting with cp_');
        } else {
            results.forEach(row => {
                console.log(`- ${row.name}`);
            });
        }

    } catch (error) {
        console.error('Unable to connect to the database:', error);
    } finally {
        await sequelize.close();
    }
}

verifyTables();
