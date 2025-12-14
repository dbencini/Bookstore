const sequelize = require('../config/database');
const UserType = require('./UserType');
const User = require('./User');
const Book = require('./Book');
const CartItem = require('./CartItem');
const Order = require('./Order');
const SiteConfig = require('./SiteConfig');
const Category = require('./Category');
const Job = require('./Job');
const OrderNote = require('./OrderNote');
const FooterSetting = require('./FooterSetting');
const OrderItem = require('./OrderItem');
const Workshop = require('./Workshop');

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

Order.hasMany(OrderNote);
OrderNote.belongsTo(Order);

OrderNote.belongsTo(User); // The author of the note

// Order Items (Snapshot of purchase)
Order.hasMany(OrderItem);
OrderItem.belongsTo(Order);

Book.hasMany(OrderItem);
OrderItem.belongsTo(Book);

// Workshop (Manufacturing tracking per item)
OrderItem.hasOne(Workshop);
Workshop.belongsTo(OrderItem);

module.exports = {
    sequelize,
    UserType,
    User,
    Book,
    CartItem,
    Order,
    SiteConfig,
    Category,
    Job,
    FooterSetting,
    OrderNote,
    OrderItem,
    Workshop
};
