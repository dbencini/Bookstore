const { sequelize, User, UserType } = require('./models');
const bcrypt = require('bcrypt');

async function seedPagination() {
    try {
        const customerRole = await UserType.findOne({ where: { name: 'Customer' } });
        const passwordHash = await bcrypt.hash('password123', 10);

        console.log('Seeding 25 extra users...');
        for (let i = 1; i <= 25; i++) {
            await User.create({
                name: `Test User ${i}`,
                email: `user${i}@test.com`,
                password_hash: passwordHash,
                userTypeId: customerRole.id
            });
        }
        console.log('Done.');
    } catch (err) {
        console.error(err);
    } finally {
        await sequelize.close();
    }
}

seedPagination();
