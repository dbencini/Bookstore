const { Workshop, OrderSource, sequelize } = require('./models');

async function backfillOrderSources() {
    try {
        await sequelize.authenticate();

        const websiteSource = await OrderSource.findOne({ where: { name: 'Website' } });

        if (!websiteSource) {
            console.error('Website Source not found! Run seed_order_sources.js first.');
            return;
        }

        console.log(`Updating all tasks with NULL source to Website (${websiteSource.id})...`);

        const [updatedRows] = await Workshop.update(
            { orderSourceId: websiteSource.id },
            { where: { orderSourceId: null } }
        );

        console.log(`Updated ${updatedRows} rows.`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sequelize.close();
    }
}

backfillOrderSources();
