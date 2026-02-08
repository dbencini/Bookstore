const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

async function listTables() {
    const sqliteSequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, 'database.sqlite'),
        logging: false
    });

    try {
        const tables = await sqliteSequelize.query("SELECT name FROM sqlite_master WHERE type='table'", {
            type: Sequelize.QueryTypes.SELECT
        });
        const tableNames = tables.map(t => t.name).sort();
        fs.writeFileSync('sqlite_tables.txt', tableNames.join('\n'), 'utf8');
        console.log('Found ' + tableNames.length + ' tables. See sqlite_tables.txt');
    } catch (err) {
        console.error('Error listing tables:', err.message);
    } finally {
        await sqliteSequelize.close();
    }
}

listTables();
