const { User, sequelize } = require('./models');
const bcrypt = require('bcrypt');

async function fixPassword() {
    const emailToTest = 'admin@bookstore.com';
    const newPassword = 'password123';

    try {
        await sequelize.authenticate();
        const user = await User.findOne({ where: { email: emailToTest } });

        if (!user) {
            console.log('User NOT FOUND.');
            return;
        }

        console.log(`Current Hash: ${user.password_hash}`);
        const matches = user.validPassword(newPassword);
        console.log(`Current password matches "${newPassword}": ${matches}`);

        if (!matches) {
            console.log(`Updating password to "${newPassword}"...`);
            const salt = bcrypt.genSaltSync(10);
            const hash = bcrypt.hashSync(newPassword, salt);
            user.password_hash = hash;
            await user.save();
            console.log('Password updated successfully.');

            const verify = user.validPassword(newPassword);
            console.log(`Verification after update: ${verify}`);
        }

    } catch (err) {
        console.error('Failed:', err);
    } finally {
        await sequelize.close();
    }
}

fixPassword();
