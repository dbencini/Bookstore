const { User, UserType, sequelize } = require('./models');

async function listUsers() {
    console.log('--- Listing All Users in MySQL ---');
    try {
        await sequelize.authenticate();
        const users = await User.findAll({
            include: [{ model: UserType }],
            order: [['email', 'ASC']]
        });

        console.log(`Total Users: ${users.length}`);
        users.forEach(u => {
            console.log(`- ${u.email} [${u.UserType ? u.UserType.name : 'NO TYPE'}] (ID: ${u.id})`);
        });

        const types = await UserType.findAll();
        console.log(`\nTotal UserTypes: ${types.length}`);
        types.forEach(t => {
            console.log(`- ${t.name} (ID: ${t.id})`);
        });

    } catch (err) {
        console.error('Failed to list users:', err);
    } finally {
        await sequelize.close();
    }
}

listUsers();
