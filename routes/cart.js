const express = require('express');
const { Book, CartItem, Order, User } = require('../models');
const router = express.Router();

// Middleware to ensure login
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/auth/login');
}

router.use(isAuthenticated);

router.get('/', async (req, res) => {
    try {
        const cartItems = await CartItem.findAll({
            where: { UserId: req.user.id },
            include: [Book]
        });

        let total = 0;
        cartItems.forEach(item => {
            total += item.quantity * item.Book.price;
        });

        res.render('cart', { cartItems, total });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/add', async (req, res) => {
    const { bookId, quantity } = req.body;
    try {
        const item = await CartItem.findOne({
            where: { UserId: req.user.id, BookId: bookId }
        });

        if (item) {
            item.quantity += parseInt(quantity);
            await item.save();
        } else {
            await CartItem.create({
                UserId: req.user.id,
                BookId: bookId,
                quantity: quantity
            });
        }
        res.redirect('/cart');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Remove item
router.post('/remove', async (req, res) => {
    const { itemId } = req.body;
    try {
        await CartItem.destroy({ where: { id: itemId, UserId: req.user.id } });
        res.redirect('/cart');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Checkout Stub
router.post('/checkout', async (req, res) => {
    try {
        const cartItems = await CartItem.findAll({ where: { UserId: req.user.id }, include: [Book] });
        if (cartItems.length === 0) return res.redirect('/cart');

        let total = 0;
        cartItems.forEach(item => total += item.quantity * item.Book.price);

        // Create Order
        await Order.create({
            UserId: req.user.id,
            total,
            status: 'completed'
        });

        // Clear Cart
        await CartItem.destroy({ where: { UserId: req.user.id } });

        res.render('cart', { cartItems: [], total: 0, message: 'Checkout successful! Thank you for your purchase.' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
