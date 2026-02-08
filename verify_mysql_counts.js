const modelsDef = require('./models');

async function verify() {
    console.log('--- Verifying MySQL Record Counts ---');
    try {
        const mysqlSequelize = modelsDef.sequelize;
        await mysqlSequelize.authenticate();
        console.log('Connected to MySQL.');

        const modelsToCheck = [
            { name: 'Users', model: modelsDef.User },
            { name: 'Books', model: modelsDef.Book },
            { name: 'OrderNotes', model: modelsDef.OrderNote },
            { name: 'CpOrders', model: modelsDef.CpOrder }
        ];

        for (const m of modelsToCheck) {
            const count = await m.model.count();
            console.log(`${m.name}: ${count.toLocaleString()} records`);
        }

        await mysqlSequelize.close();
        console.log('Verification Complete.');
    } catch (err) {
        console.error('Verification failed:', err);
    }
}

verify();
