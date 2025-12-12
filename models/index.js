const sequelize = require('../config/database');
const UserType = require('./UserType');
const User = require('./User');
const Book = require('./Book');
const CartItem = require('./CartItem');
const Order = require('./Order');
const SiteConfig = require('./SiteConfig');
const Category = require('./Category');
const Job = require('./Job');

// Associations
UserType.hasMany(User, { foreignKey: 'userTypeId' });
User.belongsTo(UserType, { foreignKey: 'userTypeId' });

Category.hasMany(Book, { foreignKey: 'categoryId' });
Book.belongsTo(Category, { foreignKey: 'categoryId' });

Job.hasMany(Book);
Book.belongsTo(Job);

User.hasMany(CartItem);
CartItem.belongsTo(User);

Book.hasMany(CartItem);
CartItem.belongsTo(Book);

User.hasMany(Order);
Order.belongsTo(User);

module.exports = {
    sequelize,
    UserType,
    User,
    Book,
    CartItem,
    Order,
    SiteConfig,
    SiteConfig,
    Category,
    Job
};
