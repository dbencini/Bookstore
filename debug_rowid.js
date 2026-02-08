const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();
const fs = require('fs');

async function check() {
    const sqliteSequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, 'database.sqlite'),
        logging: false
    });

    let output = '';
    const log = (msg) => { output += msg + '\n'; console.log(msg); };

    try {
        const mName = 'OrderNotes';
        const destCount = 5;
        const startInfo = await sqliteSequelize.query(`SELECT rowid FROM ${mName} LIMIT 1 OFFSET ${destCount - 1}`, {
            type: Sequelize.QueryTypes.SELECT
        });
        log('Query: SELECT rowid FROM OrderNotes LIMIT 1 OFFSET 4');
        log('Result length: ' + startInfo.length);
        if (startInfo.length > 0) {
            log('Result[0]: ' + JSON.stringify(startInfo[0]));
            log('Keys in Result[0]: ' + Object.keys(startInfo[0]).join(', '));
            log('Result[0].rowid: ' + startInfo[0].rowid);
        }

        const records = await sqliteSequelize.query(`SELECT rowid, * FROM OrderNotes LIMIT 1`, {
            type: Sequelize.QueryTypes.SELECT
        });
        log('\nQuery: SELECT rowid, * FROM OrderNotes LIMIT 1');
        log('Result length: ' + records.length);
        if (records.length > 0) {
            log('Result[0]: ' + JSON.stringify(records[0]));
            log('Keys in Result[0]: ' + Object.keys(records[0]).join(', '));
            log('Result[0].rowid: ' + records[0].rowid);
        }

    } catch (err) {
        log('Error: ' + err.message);
    } finally {
        await sqliteSequelize.close();
        fs.writeFileSync('debug_output_v2.txt', output, 'utf8');
    }
}

check();
