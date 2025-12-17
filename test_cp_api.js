require('dotenv').config();
const axios = require('axios');
const API_KEY = process.env.CLOUDPRINTER_API_KEY;

const CP_ORDER_URL = 'https://api.cloudprinter.com/cloudprinter/v2/orders';

async function run() {
    try {
        console.log('Testing connection...');
        const res = await axios.get(CP_ORDER_URL, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        console.log('SUCCESS: ' + res.status);
    } catch (err) {
        console.log('FAILURE: ' + (err.response ? err.response.status : err.code));
        if (err.response && err.response.data) {
            console.log('REASON: ' + JSON.stringify(err.response.data));
        }
    }
}
run();
