const { CpOrder, CpAddress, CpOrderItem, CpFile, Workshop, sequelize } = require('./models');

async function debugOrderDetails() {
    try {
        await sequelize.authenticate();
        console.log('Connected. Fetching latest CpOrder...');

        // 1. Get the latest order (our dummy)
        const order = await CpOrder.findOne({
            order: [['createdAt', 'DESC']],
            limit: 1
        });

        if (!order) {
            console.log('No CpOrder found.');
            return;
        }

        console.log(`Fetching details for Order ID: ${order.id}`);

        // 2. Reproduce the INCLUDE query from routes/admin.js WITH WORKSHOP
        try {
            const detailedOrder = await CpOrder.findByPk(order.id, {
                include: [
                    { model: CpAddress },
                    {
                        model: CpOrderItem,
                        include: [
                            { model: CpFile },
                            { model: Workshop }
                        ]
                    }
                ]
            });
            console.log('Query Successful.');
            if (detailedOrder) {
                console.log('Order Items:', detailedOrder.CpOrderItems ? detailedOrder.CpOrderItems.length : 'NULL');

                if (detailedOrder.CpOrderItems && detailedOrder.CpOrderItems.length > 0) {
                    const item = detailedOrder.CpOrderItems[0];
                    console.log('First Item Workshop:', item.Workshop ? 'FOUND' : 'NULL');
                    if (item.Workshop) {
                        console.log('ISBN:', item.Workshop.isbn);
                    }
                }
            } else {
                console.log('Order not found during detailed fetch.');
            }

        } catch (queryErr) {
            console.error('Query Error:', queryErr.message);
            console.error(queryErr);
        }

    } catch (err) {
        console.error('Global Error:', err);
    } finally {
        await sequelize.close();
    }
}

debugOrderDetails();
