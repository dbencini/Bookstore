const { sequelize, Order } = require('./models');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        // Update records where status was incorrectly set to 'Shipped'
        // Change them to 'completed' (standard value for paid/done orders)
        // We assume 'Shipped' orders are paid/done.
        const [updatedCount] = await Order.update(
            { status: 'completed' },
            { where: { status: 'Shipped' } }
        );

        console.log(`Successfully fixed ${updatedCount} orders.`);
    } catch (err) {
        console.error('Error fixing order status:', err);
    } finally {
        await sequelize.close();
    }
})();
