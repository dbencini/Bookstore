const { Workshop, OrderItem, Order, Book, OrderSource, CpOrderItem, CpOrder, CpFile, sequelize } = require('./models');

async function debugWorkshopFetch() {
    try {
        await sequelize.authenticate();
        console.log('Fetching one workshop item...');

        const ws = await Workshop.findOne({
            include: [
                { model: OrderSource },
                {
                    model: OrderItem,
                    required: false,
                    include: [
                        { model: Book },
                        { model: Order }
                    ]
                },
                {
                    model: CpOrderItem,
                    required: false,
                    include: [
                        { model: CpOrder },
                        { model: CpFile }
                    ]
                }
            ]
        });

        if (ws) {
            console.log('Workshop fetch successful.');
            console.log('ID:', ws.id);
            console.log('OrderSource:', ws.OrderSource ? ws.OrderSource.name : 'NULL');

            if (ws.CpOrderItem) {
                console.log('CpOrderItem found.');
                console.log('CpOrder:', ws.CpOrderItem.CpOrder ? 'Found' : 'NULL');
                console.log('CpFiles:', ws.CpOrderItem.CpFiles ? 'Found (Length: ' + ws.CpOrderItem.CpFiles.length + ')' : 'UNDEFINED');
                console.log('Available keys on CpOrderItem:', Object.keys(ws.CpOrderItem.toJSON()));
            } else {
                console.log('CpOrderItem is NULL');
            }
        } else {
            console.log('No workshop items found.');
        }

    } catch (err) {
        console.error('Error fetching workshop (Message):', err.message);
        // console.error('Full Error:', err);
    } finally {
        await sequelize.close();
    }
}

debugWorkshopFetch();
