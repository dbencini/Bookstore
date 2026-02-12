const express = require('express');
const { sequelize, Book, Category, User, SiteConfig, Order, Job } = require('../models');
const { Op } = require('sequelize');
const router = express.Router();
const path = require('path');

const homepageCache = new Map();
const HOMEPAGE_CACHE_TTL = 1000 * 60 * 10;

// Global Count Cache
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
        return globalBookCount || 0;
    }
};

/**
 * HIGH-PERFORMANCE SEARCH ENGINE
 * Optimized for 4.9M records in MySQL.
 * Rules:
 * - No Date Sorting (Relevance is faster and better)
 * - Capped Counting (Calculating total pages for millions of matches is slow)
 * - Stopword pruning (Required to prevent 0-result bug)
 */
async function performSearch(search, limit, offset) {
    const cleanSearch = search.trim();

    // 1. ISBN Exact Match
    const isIsbn = /^[0-9xX-\s]{10,13}$/.test(cleanSearch) && cleanSearch.replace(/[-\s]/g, '').match(/^\d{9,13}[\dXx]$/);
    if (isIsbn) {
        const cleanIsbn = cleanSearch.replace(/[-\s]/g, '');
        const books = await Book.findAll({ where: { isbn: cleanIsbn, isVisible: true }, limit, offset });
        return { books, count: books.length > 0 ? 1 : 0 };
    }

    // 2. Build Terms (Skip <3 chars and standard articles/prepositions for mandatory +)
    // Standard stopword list provided by MySQL.
    const stopwords = new Set(['the', 'and', 'for', 'with', 'about', 'from', 'that', 'this', 'was', 'are', 'not', 'but']);
    const rawTerms = cleanSearch.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(t => t.length > 0);

    const query = rawTerms.map(t => {
        const lower = t.toLowerCase();
        // Only make terms mandatory if they are likely significant
        if (lower.length < 3 || stopwords.has(lower)) return `${t}*`;
        return `+${t}*`;
    }).join(' ');

    if (!query) return { books: [], count: 0 };

    // 3. Selective Fetch (No Order By = Lightning Fast)
    const books = await sequelize.query(`
        SELECT * FROM books 
        WHERE isVisible = true 
        AND MATCH(title, author) AGAINST(:search IN BOOLEAN MODE)
        LIMIT :limit OFFSET :offset
    `, {
        replacements: { search: query, limit, offset },
        type: sequelize.QueryTypes.SELECT,
        model: Book,
        mapToModel: true
    });

    // 4. Capped Count (Calculate up to 80 results/10 pages maximum for speed)
    // This prevents the "81-second hang" on broad searches.
    const [countRes] = await sequelize.query(`
        SELECT COUNT(*) as count FROM (
            SELECT id FROM books 
            WHERE isVisible = true 
            AND MATCH(title, author) AGAINST(:search IN BOOLEAN MODE)
            LIMIT 80
        ) as sub
    `, { replacements: { search: query }, type: sequelize.QueryTypes.SELECT });

    return { books, count: countRes ? countRes.count : 0 };
}

const enrichmentService = require('../services/enrichmentService');

router.get('/books', async (req, res) => {
    let { search, category } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const offset = (page - 1) * limit;

    // Default to Bestseller category if no search or category is specified
    if (!search && !category) {
        category = 'Bestseller';
    }

    let categoryData = null;
    if (category) categoryData = await Category.findOne({ where: { name: category } });

    const cacheKey = category ? `cat_${category.replace(/\W/g, '_')}_p${page}` : `homepage_p${page}`;
    if (homepageCache.has(cacheKey) && !search) {
        const cached = homepageCache.get(cacheKey);
        if (Date.now() - cached.timestamp < HOMEPAGE_CACHE_TTL) {
            // Trigger background enrichment even on cache hit for the 8 books
            // enrichmentService.enrichBooks(cached.data.books);
            return res.render('index', { ...cached.data, search, category });
        }
    }

    try {
        let count = 0, books = [];
        if (!search) {
            if (categoryData) {
                count = categoryData.book_count;
                books = await sequelize.query(`
                    SELECT b.* FROM books b
                    JOIN book_category bc ON b.id = bc.BookId
                    WHERE bc.CategoryId = :categoryId AND b.isVisible = true 
                    ORDER BY bc.createdAt DESC LIMIT :limit OFFSET :offset
                `, {
                    replacements: { categoryId: categoryData.id, limit, offset },
                    type: sequelize.QueryTypes.SELECT, model: Book, mapToModel: true
                });
            } else {
                count = await getGlobalCount();
                books = await sequelize.query(`
                    SELECT * FROM books USE INDEX (books_is_visible_created_at)
                    WHERE isVisible = true ORDER BY createdAt DESC LIMIT :limit OFFSET :offset
                `, {
                    replacements: { limit, offset },
                    type: sequelize.QueryTypes.SELECT, model: Book, mapToModel: true
                });
            }
        } else {
            const results = await performSearch(search, limit, offset);
            books = results.books;
            count = results.count;
        }

        // Trigger background enrichment for the 8 visible books
        // enrichmentService.enrichBooks(books);

        const data = { books, currentPage: page, totalPages: Math.ceil(count / limit) };
        if (!search) homepageCache.set(cacheKey, { timestamp: Date.now(), data });
        res.render('index', { ...data, search, category });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

router.get('/books/:id', async (req, res, next) => {
    if (req.params.id === 'books') return next();
    try {
        const book = await Book.findByPk(req.params.id);
        if (!book) return res.status(404).send('Book not found');
        res.render('product-detail', { book });
    } catch (err) {
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
        res.render('profile', { user: req.user, countries, error: 'Failed' });
    }
});

module.exports = router;
