const { sequelize } = require('./models');

async function forceSyncCpTables() {
    try {
        await sequelize.authenticate();
        console.log('Connected. Dropping and re-creating CP tables to enforce UUIDs...');

        // We only want to force sync the CP tables if possible, but Sequelize syncs everything.
        // However, we can use specific model syncing.
        const { CpOrder, CpOrderItem, CpAddress, CpFile, CpSignal } = require('./models');

        // Order matters due to foreign keys. Drop children first.
        await CpSignal.drop();
        await CpAddress.drop(); // might depend on CpOrder
        await CpFile.drop();    // might depend on CpOrder/Item
        await CpOrderItem.drop();
        await CpOrder.drop();

        // Re-create
        await CpOrder.sync();
        await CpOrderItem.sync();
        await CpAddress.sync();
        await CpFile.sync();
        await CpSignal.sync();

        console.log('CP Tables successfully re-created with UUIDs.');

    } catch (error) {
        console.error('Error syncing tables:', error);
    } finally {
        await sequelize.close();
    }
}

forceSyncCpTables();
