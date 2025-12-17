const express = require('express');
const { Book } = require('../models');
const { Op } = require('sequelize');
const router = express.Router();

// Home / Books Listing
router.get('/books', async (req, res) => {
    const { search, category } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 8; // Number of books per page
    const offset = (page - 1) * limit;

    let whereClause = { isVisible: true };
    if (search) {
        whereClause[Op.or] = [
            { title: { [Op.like]: `%${search}%` } },
            { author: { [Op.like]: `%${search}%` } },
            { isbn: { [Op.like]: `%${search}%` } }
        ];
    }
    if (category) {
        whereClause.category = category;
    }

    try {
        const { count, rows: books } = await Book.findAndCountAll({
            where: whereClause,
            limit,
            offset,
            order: [['createdAt', 'DESC']] // Optional: default sort
        });

        const totalPages = Math.ceil(count / limit);

        res.render('index', {
            books,
            search,
            category,
            currentPage: page,
            totalPages
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Product Detail
router.get('/books/:id', async (req, res) => {
    try {
        const book = await Book.findByPk(req.params.id);
        if (!book) return res.status(404).send('Book not found');
        res.render('product-detail', { book });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Profile Routes
const { ensureAuthenticated } = require('../middleware/auth');
const { User } = require('../models');
const countries = require('../config/countries');

router.get('/profile', ensureAuthenticated, (req, res) => {
    res.render('profile', { user: req.user, countries });
});

router.post('/profile', ensureAuthenticated, async (req, res) => {
    try {
        const { name, email, addressStreet, addressTown, addressCity, addressProvince, addressZip, addressCountry } = req.body;
        const user = await User.findByPk(req.user.id);

        if (email !== user.email) {
            const existing = await User.findOne({ where: { email } });
            if (existing) {
                return res.render('profile', { user, countries, error: 'Email already currently in use by another account.' });
            }
            user.email = email;
            user.emailVerified = false;
        }

        user.name = name;
        user.addressStreet = addressStreet;
        user.addressTown = addressTown;
        user.addressCity = addressCity;
        user.addressProvince = addressProvince;
        user.addressZip = addressZip;
        user.addressCountry = addressCountry;

        await user.save();

        res.render('profile', { user, countries, success: 'Profile updated successfully.' });
    } catch (err) {
        console.error(err);
        res.render('profile', { user: req.user, countries, error: 'Failed to update profile.' });
    }
});

module.exports = router;
