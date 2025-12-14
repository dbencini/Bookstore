const crypto = require('crypto');

// Simplified Setup (as per user docs)
// Test Mode: 10000100
// Live Mode: Your Merchant ID
const PAYFAST_MERCHANT_ID = '10000100'; // Default Sandbox
const PAYFAST_URL = 'https://sandbox.payfast.co.za/eng/process';

// No keys or passphrases needed for _paynow!

/**
 * Generate PayFast Signature (Legacy / ITN verification only)
 * Even though checkout doesn't need it, ITN might still send one.
 * But referencing the user's docs: "Signature Verification: REMOVED".
 * So we might not even strictly need this? 
 * I'll keep it as a helper but it won't be used for checkout.
 */
function generateSignature(data, passPhrase = null) {
    let pfOutput = '';
    const keys = Object.keys(data).sort();
    const filteredKeys = keys.filter(k => k !== 'signature');

    filteredKeys.forEach((key) => {
        if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
            const val = String(data[key]).trim();
            pfOutput += `${key}=${encodeURIComponent(val).replace(/%20/g, "+")}&`;
        }
    });

    pfOutput = pfOutput.slice(0, -1);
    if (passPhrase) {
        pfOutput += `&passphrase=${encodeURIComponent(passPhrase.trim()).replace(/%20/g, "+")}`;
    }
    return crypto.createHash('md5').update(pfOutput).digest('hex');
}

module.exports = {
    PAYFAST_MERCHANT_ID,
    PAYFAST_URL,
    generateSignature
};
