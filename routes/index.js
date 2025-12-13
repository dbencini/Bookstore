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
            { author: { [Op.like]: `%${search}%` } }
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

module.exports = router;
