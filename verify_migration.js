const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const modelsDef = require('./models');

async function verify() {
    console.log('--- Migration Verification ---');

    const sqlite = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, 'database.sqlite'),
        logging: false
    });

    const mysql = modelsDef.sequelize;

    const tables = [
        { name: 'UserTypes', model: modelsDef.UserType },
        { name: 'Users', model: modelsDef.User },
        { name: 'Categories', model: modelsDef.Category },
        { name: 'Jobs', model: modelsDef.Job },
        { name: 'Books', model: modelsDef.Book },
        { name: 'BookCategories', model: modelsDef.BookCategory },
        { name: 'OrderSources', model: modelsDef.OrderSource },
        { name: 'Orders', model: modelsDef.Order },
        { name: 'OrderNotes', model: modelsDef.OrderNote },
        { name: 'OrderItems', model: modelsDef.OrderItem },
        { name: 'Workshops', model: modelsDef.Workshop },
        { name: 'SiteConfigs', model: modelsDef.SiteConfig },
        { name: 'FooterSettings', model: modelsDef.FooterSetting },
        { name: 'CartItems', model: modelsDef.CartItem },
        { name: 'CpOrders', model: modelsDef.CpOrder },
        { name: 'CpOrderItems', model: modelsDef.CpOrderItem },
        { name: 'CpAddresses', model: modelsDef.CpAddress },
        { name: 'CpFiles', model: modelsDef.CpFile },
        { name: 'CpSignals', model: modelsDef.CpSignal }
    ];

    console.log('Table'.padEnd(20) + ' | ' + 'SQLite'.padStart(12) + ' | ' + 'MySQL'.padStart(12) + ' | ' + 'Status');
    console.log('-'.repeat(60));

    for (const t of tables) {
        if (!t.model) continue;

        let sCount = 0;
        try {
            const r = await sqlite.query(`SELECT COUNT(*) as count FROM ${t.name}`, { type: Sequelize.QueryTypes.SELECT });
            sCount = r[0].count;
        } catch (e) {
            sCount = -1;
        }

        let mCount = 0;
        try {
            mCount = await t.model.count();
        } catch (e) {
            mCount = -1;
        }

        const status = (sCount === mCount) ? 'OK' : (sCount > mCount ? 'MISSING' : 'EXTRA');
        console.log(t.name.padEnd(20) + ' | ' + sCount.toLocaleString().padStart(12) + ' | ' + mCount.toLocaleString().padStart(12) + ' | ' + status);
    }

    await sqlite.close();
    await mysql.close();
}

verify();
