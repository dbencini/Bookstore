const express = require('express');
const { sequelize, Book, Category, User, SiteConfig, Order, Job } = require('../models');
const { Op } = require('sequelize');
const router = express.Router();
const path = require('path');

const homepageCache = new Map();
const HOMEPAGE_CACHE_TTL = 1000 * 60 * 10;

// Global Count Cache (Module Scope)
let globalBookCount = null;
let lastCountFetch = 0;
const GLOBAL_COUNT_TTL = 1000 * 60 * 60; // 1 hour

const getGlobalCount = async () => {
    if (globalBookCount !== null && (Date.now() - lastCountFetch < GLOBAL_COUNT_TTL)) {
        return globalBookCount;
    }
    try {
        const [result] = await sequelize.query('SELECT COUNT(*) as count FROM books WHERE isVisible = true');
        globalBookCount = (result && result[0]) ? result[0].count : (globalBookCount || 0);
        lastCountFetch = Date.now();
        return globalBookCount;
    } catch (err) {
        console.error('Failed to fetch global count:', err);
        return globalBookCount || 0;
    }
};

router.get('/books', async (req, res) => {
    const { search, category } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const offset = (page - 1) * limit;

    // Base WhereClause: Always visible, always have valid authors and descriptions
    const whereClause = {
        isVisible: true,
        author: {
            [Op.and]: [
                { [Op.ne]: null },
                { [Op.ne]: '' },
                { [Op.ne]: 'Unknown' }
            ]
        },
        description: {
            [Op.and]: [
                { [Op.ne]: null },
                { [Op.ne]: '' },
                { [Op.ne]: 'No description available.' }
            ]
        }
    };
    const isSearching = !!(search || category);

    if (isSearching) {
        if (search) {
            whereClause[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { author: { [Op.like]: `%${search}%` } },
                { isbn: { [Op.like]: `%${search}%` } }
            ];
        }
    } else {
        whereClause.imageUrl = {
            [Op.and]: [
                { [Op.ne]: null },
                { [Op.ne]: '' },
                { [Op.ne]: '/images/placeholder-book.png' },
                { [Op.ne]: 'https://placehold.co/200x300' },
                { [Op.ne]: '/images/default_cover.svg' }
            ]
        };
    }

    let categoryFilter = null;
    let categoryData = null;
    if (category) {
        // Find category and its associated books via join table
        categoryData = await Category.findOne({ where: { name: category } });
        if (categoryData) {
            categoryFilter = {
                model: Category,
                where: { id: categoryData.id },
                through: { attributes: [] },
                required: true
            };
        } else {
            // Category not found, return nothing
            whereClause.id = '00000000-0000-0000-0000-000000000000';
        }
    }

    // Caching Strategy: Cache the default view AND specific categories (Page 1)
    const cacheKey = category ? `cat_${category.replace(/\W/g, '_')}_p${page}` : `homepage_p${page}`;
    if (homepageCache.has(cacheKey) && !search) {
        const cached = homepageCache.get(cacheKey);
        if (Date.now() - cached.timestamp < HOMEPAGE_CACHE_TTL) {
            return res.render('index', { ...cached.data, search, category });
        }
    }

    try {
        let count, books;

        if (!search) {
            // High-performance path: Use Index Hint + Count Caching
            if (categoryData) {
                count = categoryData.book_count;
                books = await sequelize.query(`
                    SELECT * FROM books USE INDEX (books_is_visible_created_at)
                    WHERE isVisible = true 
                    AND author IS NOT NULL 
                    AND author != '' 
                    AND author != 'Unknown'
                    AND description IS NOT NULL
                    AND description != ''
                    AND description != 'No description available.'
                    AND id IN (SELECT BookId FROM book_category WHERE CategoryId = :categoryId) 
                    ORDER BY createdAt DESC 
                    LIMIT :limit OFFSET :offset
                `, {
                    replacements: { categoryId: categoryData.id, limit, offset },
                    type: sequelize.QueryTypes.SELECT,
                    model: Book,
                    mapToModel: true
                });
            } else {
                // Global view: Use cached count + Index Hint
                count = await getGlobalCount();
                books = await sequelize.query(`
                    SELECT * FROM books USE INDEX (books_is_visible_created_at)
                    WHERE isVisible = true 
                    AND author IS NOT NULL 
                    AND author != '' 
                    AND author != 'Unknown'
                    AND description IS NOT NULL
                    AND description != ''
                    AND description != 'No description available.'
                    ORDER BY createdAt DESC 
                    LIMIT :limit OFFSET :offset
                `, {
                    replacements: { limit, offset },
                    type: sequelize.QueryTypes.SELECT,
                    model: Book,
                    mapToModel: true
                });
            }
        } else {
            // Text Search path (less frequent, relies on search indexes)
            const queryOptions = {
                where: whereClause,
                limit,
                offset,
                order: [['createdAt', 'DESC']],
                subQuery: false
            };
            if (categoryFilter) queryOptions.include = [categoryFilter];

            const result = await Book.findAndCountAll(queryOptions);
            count = result.count;
            books = result.rows;
        }

        const data = {
            books,
            currentPage: page,
            totalPages: Math.ceil(count / limit)
        };

        // Save to cache if no text search
        if (!search) {
            homepageCache.set(cacheKey, { timestamp: Date.now(), data });
        }

        res.render('index', {
            ...data,
            search,
            category
        });
    } catch (err) {
        console.error('[CRITICAL Index Error]', err.stack || err);
        res.status(500).send('Server Error: ' + err.message);
    }
});

router.get('/books/:id', async (req, res, next) => {
    // Basic check to prevent "books" being caught as an ID
    if (req.params.id === 'books') return next();

    try {
        const book = await Book.findByPk(req.params.id);
        if (!book) return res.status(404).send('Book not found');
        res.render('product-detail', { book });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

const { ensureAuthenticated } = require('../middleware/auth');
const countries = require('../config/countries');

router.get('/profile', ensureAuthenticated, (req, res) => {
    res.render('profile', { user: req.user, countries });
});

router.post('/profile', ensureAuthenticated, async (req, res) => {
    try {
        const { name, email, ...addressFields } = req.body;
        const user = await User.findByPk(req.user.id);
        if (email !== user.email) {
            const existing = await User.findOne({ where: { email } });
            if (existing) return res.render('profile', { user, countries, error: 'Email in use' });
            user.email = email;
        }
        Object.assign(user, addressFields);
        user.name = name;
        await user.save();
        res.render('profile', { user, countries, success: 'Updated' });
    } catch (err) {
        console.error(err);
        res.render('profile', { user: req.user, countries, error: 'Failed' });
    }
});

module.exports = router;
