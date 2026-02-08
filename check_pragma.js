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

    try {
        const info = await sqliteSequelize.query(`PRAGMA table_info(OrderNotes)`, {
            type: Sequelize.QueryTypes.SELECT
        });
        const info2 = await sqliteSequelize.query(`PRAGMA table_info(Orders)`, {
            type: Sequelize.QueryTypes.SELECT
        });

        const output = {
            OrderNotes: info,
            Orders: info2
        };

        fs.writeFileSync('pragma_output_v2.json', JSON.stringify(output, null, 2), 'utf8');
        console.log('Wrote pragma_output_v2.json');

    } catch (err) {
        console.error(err);
    } finally {
        await sqliteSequelize.close();
    }
}

check();
