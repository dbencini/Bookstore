const { Workshop, OrderSource, sequelize } = require('./models');

async function checkOrderSources() {
    try {
        await sequelize.authenticate();

        const count = await Workshop.count();
        const nullSourceCount = await Workshop.count({ where: { orderSourceId: null } });
        const websiteSource = await OrderSource.findOne({ where: { name: 'Website' } });

        console.log(`Total Workshop Tasks: ${count}`);
        console.log(`Tasks with NULL OrderSource: ${nullSourceCount}`);

        if (websiteSource) {
            console.log(`Website Source ID: ${websiteSource.id}`);
        } else {
            console.log('Website Source NOT FOUND');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sequelize.close();
    }
}

checkOrderSources();
