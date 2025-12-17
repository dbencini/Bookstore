const { sequelize, OrderSource } = require('./models');

async function seedOrderSources() {
    try {
        await sequelize.authenticate();
        await sequelize.sync(); // Update schema with new tables/cols

        const sources = ['Website', 'Cloud Print'];

        for (const name of sources) {
            const [source, created] = await OrderSource.findOrCreate({
                where: { name },
                defaults: { name }
            });
            if (created) {
                console.log(`Created OrderSource: ${name}`);
            } else {
                console.log(`OrderSource already exists: ${name}`);
            }
        }
    } catch (error) {
        console.error('Error seeding OrderSources:', error);
    } finally {
        await sequelize.close();
    }
}

seedOrderSources();
