const { sequelize, User, UserType } = require('./models');

async function checkAdmin() {
    try {
        const users = await User.findAll({ include: UserType });
        console.log('--- Users ---');
        const bcrypt = require('bcrypt');
        users.forEach(u => {
            const isMatch = u.password_hash ? bcrypt.compareSync('password123', u.password_hash) : false;
            console.log(`ID: ${u.id}, Name: ${u.name}, Email: ${u.email}, Role: ${u.UserType ? u.UserType.name : 'None'}, TypeID: ${u.userTypeId}, PasswordMatch: ${isMatch}`);
        });

        const types = await UserType.findAll();
        console.log('--- Types ---');
        types.forEach(t => {
            console.log(`ID: ${t.id}, Name: ${t.name}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await sequelize.close();
    }
}

checkAdmin();
