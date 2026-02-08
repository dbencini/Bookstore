const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

async function check() {
    const sqliteSequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, 'database.sqlite'),
        logging: false
    });

    try {
        const mName = 'OrderNotes';
        const startInfo = await sqliteSequelize.query(`SELECT rowid AS migration_rowid FROM ${mName} LIMIT 1`, {
            type: Sequelize.QueryTypes.SELECT
        });
        console.log('Result for OrderNotes (INTEGER PK):', JSON.stringify(startInfo[0]));

        const mName2 = 'Orders';
        const startInfo2 = await sqliteSequelize.query(`SELECT rowid AS migration_rowid FROM ${mName2} LIMIT 1`, {
            type: Sequelize.QueryTypes.SELECT
        });
        console.log('Result for Orders (UUID PK):', JSON.stringify(startInfo2[0]));

    } catch (err) {
        console.error(err);
    } finally {
        await sqliteSequelize.close();
    }
}

check();
