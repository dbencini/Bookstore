const { sequelize, CpOrder, CpOrderItem, CpAddress, CpFile, Workshop, OrderSource } = require('./models');
const { v4: uuidv4 } = require('uuid');

async function seedMultiBookOrder() {
    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        // Get Cloud Print Source
        const source = await OrderSource.findOne({ where: { name: 'Cloud Print' } });
        if (!source) {
            console.error('Cloud Print source not found! Run seed_order_sources.js first.');
            return;
        }

        const orderId = uuidv4();
        const item1Id = uuidv4();
        const item2Id = uuidv4();
        const cpOrderId = 'CP-MULTI-9000';

        console.log(`Creating Order ${cpOrderId} with 2 items...`);

        // 1. Create Order
        await CpOrder.create({
            id: orderId,
            cpOrderId: cpOrderId,
            clientReference: 'REF-MULTI-BOOK',
            status: 'production_ex',
            fullJsonPayload: JSON.stringify({
                order: {
                    id: cpOrderId,
                    reference: 'REF-MULTI-BOOK',
                    shipping: {
                        method: 'Economy',
                        price: 15.00
                    },
                    client: {
                        email: 'multi_book_user@example.com'
                    },
                    items: [
                        {
                            reference: 'ITEM-001',
                            options: [
                                { type: 'cover_finish', desc: 'Gloss' },
                                { type: 'paper_weight', desc: '80gsm' }
                            ]
                        },
                        {
                            reference: 'ITEM-002',
                            options: [
                                { type: 'cover_finish', desc: 'Matte' },
                                { type: 'binding', desc: 'Perfect Bound' }
                            ]
                        }
                    ]
                }
            })
        });

        // 2. Create Address
        await CpAddress.create({
            id: uuidv4(),
            CpOrderId: orderId,
            type: 'shipping',
            name: 'Biblioophile Reader',
            street1: '42 Library Lane',
            city: 'Booktown',
            zip: '12345',
            country: 'US',
            email: 'reader@example.com'
        });

        // 3. Create Item 1
        await CpOrderItem.create({
            id: item1Id,
            CpOrderId: orderId,
            cpItemId: 'ITEM-001',
            productCode: 'BOOK_A5_SOFT',
            quantity: 5,
            title: 'The Multi-Book Volume 1',
            status: 'production_ex'
        });

        // 3.1 Workshop for Item 1
        await Workshop.create({
            id: uuidv4(),
            orderSourceId: source.id,
            CpOrderItemId: item1Id,
            threeKnife: false,
            dispatch: false,
            bookTitle: 'The Multi-Book Volume 1',
            isbn: '978-1-111-11111-1'
        });

        // 3.2 Files for Item 1
        await CpFile.create({
            id: uuidv4(),
            CpOrderItemId: item1Id,
            type: 'cover',
            url: 'https://example.com/cover_vol1.pdf',
            format: 'pdf',
            md5sum: 'dummy_hash_1'
        });
        await CpFile.create({
            id: uuidv4(),
            CpOrderItemId: item1Id,
            type: 'book',
            url: 'https://example.com/book_vol1.pdf',
            format: 'pdf',
            md5sum: 'dummy_hash_2'
        });

        // 4. Create Item 2
        await CpOrderItem.create({
            id: item2Id,
            CpOrderId: orderId,
            cpItemId: 'ITEM-002',
            productCode: 'BOOK_A5_HARD',
            quantity: 2,
            title: 'The Multi-Book Volume 2',
            status: 'production_ex'
        });

        // 4.1 Workshop for Item 2
        await Workshop.create({
            id: uuidv4(),
            orderSourceId: source.id,
            CpOrderItemId: item2Id,
            threeKnife: false,
            dispatch: false,
            bookTitle: 'The Multi-Book Volume 2',
            isbn: '978-2-222-22222-2'
        });

        // 4.2 Files for Item 2
        await CpFile.create({
            id: uuidv4(),
            CpOrderItemId: item2Id,
            type: 'cover',
            url: 'https://example.com/cover_vol2.pdf',
            format: 'pdf',
            md5sum: 'dummy_hash_3'
        });
        await CpFile.create({
            id: uuidv4(),
            CpOrderItemId: item2Id,
            type: 'book',
            url: 'https://example.com/book_vol2.pdf',
            format: 'pdf',
            md5sum: 'dummy_hash_4'
        });

        console.log('Seeding completed successfully!');

    } catch (err) {
        console.error('Error seeding data:', err);
    } finally {
        await sequelize.close();
    }
}

seedMultiBookOrder();
