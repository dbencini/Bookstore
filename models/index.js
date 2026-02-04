const sequelize = require('../config/database');
const UserType = require('./UserType');
const User = require('./User');
const Book = require('./Book');
const CartItem = require('./CartItem');
const Order = require('./Order');
const SiteConfig = require('./SiteConfig');
const Category = require('./Category');
const BookCategory = require('./BookCategory');
const Job = require('./Job');
const OrderNote = require('./OrderNote');
const FooterSetting = require('./FooterSetting');
const OrderItem = require('./OrderItem');
const Workshop = require('./Workshop');
const OrderSource = require('./OrderSource');

// CloudPrinter Models
const CpOrder = require('./CpOrder');
const CpOrderItem = require('./CpOrderItem');
const CpAddress = require('./CpAddress');
const CpFile = require('./CpFile');
const CpSignal = require('./CpSignal');

// Associations
UserType.hasMany(User, { foreignKey: 'userTypeId' });
User.belongsTo(UserType, { foreignKey: 'userTypeId' });

Book.belongsToMany(Category, { through: BookCategory });
Category.belongsToMany(Book, { through: BookCategory });

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
// Workshop can belong to either a local OrderItem or a CloudPrinter OrderItem
// We'll use orderSourceId to distinguish
Workshop.belongsTo(OrderSource, { foreignKey: 'orderSourceId' });
OrderSource.hasMany(Workshop, { foreignKey: 'orderSourceId' });

Workshop.belongsTo(OrderItem); // Regular website orders
OrderItem.hasOne(Workshop);

Workshop.belongsTo(CpOrderItem); // CloudPrinter orders
CpOrderItem.hasOne(Workshop);

// CloudPrinter Associations

// CloudPrinter Associations
CpOrder.hasMany(CpOrderItem);
CpOrderItem.belongsTo(CpOrder);

CpOrder.hasMany(CpAddress);
CpAddress.belongsTo(CpOrder);

CpOrder.hasMany(CpFile); // For order level files like shipping labels
CpFile.belongsTo(CpOrder);

CpOrderItem.hasMany(CpFile); // For item level files like cover/book
CpFile.belongsTo(CpOrderItem);

CpOrder.hasMany(CpSignal);
CpSignal.belongsTo(CpOrder);

CpOrderItem.hasMany(CpSignal);
CpSignal.belongsTo(CpOrderItem);

module.exports = {
    sequelize,
    UserType,
    User,
    Book,
    CartItem,
    Order,
    SiteConfig,
    Category,
    BookCategory,
    Job,
    FooterSetting,
    OrderNote,
    OrderItem,
    Workshop,
    OrderSource,
    CpOrder,
    CpOrderItem,
    CpAddress,
    CpFile,
    CpSignal
};
