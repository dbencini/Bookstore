const { User, sequelize } = require('./models');

async function inspectUser() {
    const emailToTest = 'admin@bookstore.com';
    console.log(`--- Inspecting User: ${emailToTest} ---`);
    try {
        await sequelize.authenticate();
        const user = await User.findOne({ where: { email: emailToTest } });

        if (!user) {
            console.log('User NOT FOUND in MySQL.');
            return;
        }

        console.log('User Details:');
        console.log(`ID: ${user.id}`);
        console.log(`Name: ${user.name}`);
        console.log(`Email: ${user.email}`);
        console.log(`Password Hash: ${user.password_hash}`);
        console.log(`Hash Length: ${user.password_hash ? user.password_hash.length : 0}`);

    } catch (err) {
        console.error('Inspection failed:', err);
    } finally {
        await sequelize.close();
    }
}

inspectUser();
