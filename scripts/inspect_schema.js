require('dotenv').config();
const { sequelize } = require('../models');
const fs = require('fs');
const path = require('path');

async function inspect() {
    try {
        const [res] = await sequelize.query('SHOW CREATE TABLE book_category');
        const schema = res[0]['Create Table'];
        console.log(schema);
        fs.writeFileSync(path.join(__dirname, 'schema_output.txt'), schema);
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

inspect();
