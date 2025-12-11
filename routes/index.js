const express = require('express');
const { Book } = require('../models');
const { Op } = require('sequelize');
const router = express.Router();

// Home / Books Listing
router.get('/books', async (req, res) => {
    const { search, category } = req.query;
    let whereClause = { isVisible: true }; // Add this line to filter by isVisible: true
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
        const books = await Book.findAll({ where: whereClause });
        res.render('index', { books, search });
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
