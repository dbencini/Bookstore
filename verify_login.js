const { User, sequelize } = require('./models');
const bcrypt = require('bcrypt');

async function checkLogin() {
    try {
        const user = await User.findOne({ where: { email: 'admin@bookstore.com' } });
        if (!user) {
            console.log('User NOT FOUND');
            return;
        }
        console.log('User FOUND:', user.email);

        const match = await bcrypt.compare('password123', user.password_hash);
        console.log('Password Match:', match);

        if (match) {
            console.log('Login SHOULD work.');
        } else {
            console.log('Login WILL FAIL (Password mismatch).');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sequelize.close();
    }
}

checkLogin();
