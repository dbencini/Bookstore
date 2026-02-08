const { User, sequelize } = require('./models');
const bcrypt = require('bcrypt');

async function testLogin() {
    console.log('--- Testing User Lookup in MySQL ---');
    try {
        await sequelize.authenticate();
        console.log('Connected to MySQL.');

        const users = await User.findAll({ limit: 5 });
        console.log(`Found ${users.length} users.`);

        for (const user of users) {
            console.log(`User: ${user.email}, Has Password Hash: ${!!user.password_hash}`);
        }

        // Test a specific email if you have one, or just check the first one with a hash
        const userWithHash = users.find(u => u.password_hash);
        if (userWithHash) {
            console.log(`Testing validPassword for ${userWithHash.email}...`);
            // We don't know the password, but we can check if it fails/succeeds appropriately
            // with a dummy password to ensure bcrypt doesn't crash
            try {
                const isValid = userWithHash.validPassword('dummy');
                console.log(`Password check completed. Is valid: ${isValid}`);
            } catch (e) {
                console.error('validPassword crashed:', e);
            }
        }

    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        await sequelize.close();
    }
}

testLogin();
