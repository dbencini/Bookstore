const express = require('express');
const router = express.Router();
const { User, UserType, Book, Category, Job } = require('../models');
// ...

// Book Management


// ...

// Book Management
// Middleware Imports
const requireAdmin = require('../middleware/adminAuth');
const { fetchGoogleBooks, fixBookData, cancelJob } = require('../services/bookService');
const bcrypt = require('bcrypt');

// Apply Auth Middleware Globally to this Router
router.use(requireAdmin);

// Dashboard
router.get('/', async (req, res) => {
    const userCount = await User.count();
    const bookCount = await Book.count();
    const adminCount = await User.count({
        include: { model: UserType, where: { name: 'Admin' } }
    });

    res.render('admin/dashboard', {
        userCount,
        bookCount,
        adminCount,
        page: 'dashboard'
    });
});

// User Management
router.get('/users', async (req, res) => {
    try {
        const { page = 1, search = '', typeId = '' } = req.query;
        const limit = 20;
        const offset = (page - 1) * limit;

        const { Op } = require('sequelize');
        const { Sequelize } = require('../models');

        // Build Filter
        const where = {};
        if (search) {
            const lowerSearch = search.toLowerCase();
            where[Op.or] = [
                Sequelize.where(
                    Sequelize.fn('lower', Sequelize.col('User.name')),
                    'LIKE',
                    `%${lowerSearch}%`
                ),
                Sequelize.where(
                    Sequelize.fn('lower', Sequelize.col('User.email')),
                    'LIKE',
                    `%${lowerSearch}%`
                )
            ];
        }
        if (typeId) {
            where.userTypeId = typeId;
        }

        const { count, rows } = await User.findAndCountAll({
            where,
            include: { model: UserType },
            limit,
            offset,
            order: [['createdAt', 'DESC']]
        });

        const userTypes = await UserType.findAll();
        const totalPages = Math.ceil(count / limit);

        res.render('admin/users', {
            users: rows,
            userTypes,
            page: 'users',
            currentPage: parseInt(page),
            totalPages,
            search,
            currentType: typeId
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/users/:id/update', async (req, res) => {
    try {
        const { email, password, userTypeId } = req.body;
        const user = await User.findByPk(req.params.id);

        if (user) {
            user.email = email;
            if (password) {
                user.password_hash = await bcrypt.hash(password, 10);
            }
            if (userTypeId) {
                user.userTypeId = userTypeId;
            }
            await user.save();
        }
        res.redirect('/admin/users');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/users?error=UpdateFailed');
    }
});

// Book Management
router.get('/books', async (req, res) => {
    try {
        const { page = 1, title, author, category, startDate, endDate } = req.query;
        const limit = 12;
        const offset = (page - 1) * limit;
        const { Op } = require('sequelize');

        // Build Where Clause
        const where = {};
        const include = [];

        if (title) where.title = { [Op.like]: `%${title}%` };
        if (author) where.author = { [Op.like]: `%${author}%` };

        // Date Range Search
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt[Op.gte] = new Date(startDate);
            if (endDate) {
                // Set to end of day
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                where.createdAt[Op.lte] = end;
            }
        }

        // Category Search (via Association)
        const categoryInclude = { model: Category };
        if (category) {
            categoryInclude.where = { name: { [Op.like]: `%${category}%` } };
        }
        include.push(categoryInclude);

        const { count, rows } = await Book.findAndCountAll({
            where,
            include,
            limit,
            offset,
            order: [['createdAt', 'DESC']]
        });

        // Fetch categories for combobox in Edit modal (and potential filter dropdown if needed later)
        const categories = await Category.findAll({ order: [['name', 'ASC']] });
        const totalPages = Math.ceil(count / limit);

        res.render('admin/books', {
            books: rows,
            totalBooks: count,
            categories,
            page: 'books',
            currentPage: parseInt(page),
            totalPages,
            filters: { title, author, category, startDate, endDate }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/books/:id/toggle', async (req, res) => {
    try {
        const book = await Book.findByPk(req.params.id);
        if (book) {
            book.isVisible = !book.isVisible;
            await book.save();
        }

        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.json({ success: true, isVisible: book ? book.isVisible : false });
        }
        res.redirect('/admin/books');
    } catch (err) {
        console.error(err);
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.redirect('/admin/books?error=ToggleFailed');
    }
});

router.post('/books/:id/delete', async (req, res) => {
    try {
        await Book.destroy({ where: { id: req.params.id } });

        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.json({ success: true });
        }
        res.redirect('/admin/books');
    } catch (err) {
        console.error(err);
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.redirect('/admin/books?error=DeleteFailed');
    }
});

router.post('/books/:id/update', async (req, res) => {
    try {
        const book = await Book.findByPk(req.params.id);
        if (book) {
            const { categoryId, price, imageUrl, stock, description, isVisible } = req.body;
            console.log('[DEBUG] Update Body:', req.body);
            console.log('[DEBUG] Received Description:', description);

            if (categoryId) book.categoryId = categoryId;
            if (price) book.price = parseFloat(price);
            if (imageUrl) book.imageUrl = imageUrl;

            if (stock !== undefined && stock !== '') {
                const stockVal = parseInt(stock, 10);
                if (!isNaN(stockVal)) book.stock = stockVal;
            }

            if (description !== undefined) book.description = description;

            // Checkbox handling: likely 'on' if checked, undefined if unchecked
            book.isVisible = (isVisible === 'on');

            await book.save();

            // Return JSON if client expects it (fetch)
            if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
                return res.json({ success: true, book });
            }
        } else {
            if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
                return res.status(404).json({ success: false, error: 'Book not found' });
            }
        }
        res.redirect('/admin/books');
    } catch (err) {
        console.error(err);
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.status(500).json({ success: false, error: 'Server Error: ' + err.message });
        }
        res.redirect('/admin/books?error=UpdateFailed');
    }
});

// Job Management
router.get('/jobs', async (req, res) => {
    try {
        const jobs = await Job.findAll({
            include: [{
                model: Book,
                limit: 10, // Only get thumbnails for first 10
                attributes: ['title', 'imageUrl', 'author', 'description']
            }],
            order: [['startTime', 'DESC']],
            limit: 20 // Show last 20 jobs
        });

        res.render('admin/jobs', {
            page: 'jobs',
            jobs
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error fetching jobs');
    }
});

router.post('/jobs/trigger', async (req, res) => {
    try {
        await fetchGoogleBooks(req.body.query || 'subject:fiction');
        res.redirect('/admin/jobs');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/jobs?error=JobFailed');
    }
});

router.post('/jobs/fix-data', async (req, res) => {
    try {
        // Trigger async - don't wait for completion
        fixBookData();
        // Pause briefly to let the job creation happen so it appears on the list
        await new Promise(r => setTimeout(r, 500));
        res.redirect('/admin/jobs');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/jobs?error=FixFailed');
    }
});

router.post('/jobs/:id/stop', async (req, res) => {
    try {
        const result = cancelJob(req.params.id);
        if (result) {
            // Wait briefly for the loop to break
            await new Promise(r => setTimeout(r, 600));
        }
        res.redirect('/admin/jobs');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/jobs?error=StopFailed');
    }
});

module.exports = router;
