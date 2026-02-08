const { User, UserType, sequelize } = require('./models');
const bcrypt = require('bcrypt');

async function simulateLogin() {
    const emailToTest = 'user2@test.com'; // Adjust to a real email from your DB
    const passwordToTest = 'password';    // Adjust to a real password if known

    console.log(`--- Simulating Login for ${emailToTest} ---`);
    try {
        await sequelize.authenticate();
        console.log('Connected to MySQL.');

        const user = await User.findOne({
            where: { email: emailToTest },
            include: [{ model: UserType }]
        });

        if (!user) {
            console.log('User not found in MySQL.');
            return;
        }

        console.log(`User found: ${user.name} (${user.id})`);
        console.log(`UserType: ${user.UserType ? user.UserType.name : 'None'}`);

        if (user.password_hash) {
            console.log('Password hash present.');
            // Test with a dummy if we don't know the password
            const isValid = user.validPassword('wrong_password');
            console.log(`ValidPassword('wrong_password') result: ${isValid} (Expected false)`);
        } else {
            console.log('No password hash for this user.');
        }

    } catch (err) {
        console.error('Simulation failed:', err);
        if (err.name === 'SequelizeDatabaseError') {
            console.error('SQL:', err.sql);
        }
    } finally {
        await sequelize.close();
    }
}

simulateLogin();
