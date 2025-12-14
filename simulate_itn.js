const axios = require('axios'); // You might need to install axios or use fetch if node 18+
const { generateSignature, PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY } = require('./config/payfast');
const { Order } = require('./models');

// Usage: node simulate_itn.js <ORDER_ID> <AMOUNT>
// Example: node simulate_itn.js 1 100.00

async function simulate() {
    const orderId = process.argv[2];
    const amount = process.argv[3];

    if (!orderId || !amount) {
        console.log('Usage: node simulate_itn.js <ORDER_ID> <AMOUNT>');
        process.exit(1);
    }

    const payload = {
        m_payment_id: orderId,
        pf_payment_id: '123456789',
        payment_status: 'COMPLETE',
        item_name: `Order #${orderId}`,
        item_description: 'Simulation',
        amount_gross: parseFloat(amount).toFixed(2),
        amount_fee: '-2.00',
        amount_net: (parseFloat(amount) - 2.00).toFixed(2),
        custom_str1: '',
        custom_str2: '',
        custom_str3: '',
        custom_str4: '',
        custom_str5: '',
        custom_int1: '',
        custom_int2: '',
        custom_int3: '',
        custom_int4: '',
        custom_int5: '',
        name_first: 'Test',
        name_last: 'User',
        email_address: 'test@example.com',
        merchant_id: PAYFAST_MERCHANT_ID,
        // passphrase: PAYFAST_PASSPHRASE, // Not sent in body, but used in signature
        signature: ''
    };

    // Generate Signature
    payload.signature = generateSignature(payload);

    console.log('Simulating ITN for Order:', orderId);
    console.log('Payload:', payload);

    try {
        // Use native fetch (Node 18+)
        const response = await fetch('http://localhost:3001/cart/checkout/notify', {
            method: 'POST',
            body: new URLSearchParams(payload),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const text = await response.text();
        console.log('Response:', response.status, text);
        if (response.status === 200) {
            console.log('SUCCESS: ITN processed.');
        } else {
            console.log('FAILED: ITN rejected.');
        }
    } catch (err) {
        console.error('Error sending ITN:', err);
    }
}

simulate();
