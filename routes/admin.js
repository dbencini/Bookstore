const express = require('express');
const router = express.Router();
const { User, UserType, Book, Category } = require('../models');
// ...

// Book Management


// ...

router.post('/books/:id/update', async (req, res) => {
    try {
        const book = await Book.findByPk(req.params.id);
        if (book) {
            if (req.body.imageUrl !== undefined) book.imageUrl = req.body.imageUrl;
            if (req.body.categoryId !== undefined) book.categoryId = req.body.categoryId;
            await book.save();
        }
        res.redirect('/admin/books');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/books?error=UpdateFailed');
    }
});
const requireAdmin = require('../middleware/adminAuth');
const { fetchGoogleBooks } = require('../services/bookService');
const bcrypt = require('bcrypt');

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
        res.redirect('/admin/books');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/books?error=ToggleFailed');
    }
});

router.post('/books/:id/delete', async (req, res) => {
    try {
        await Book.destroy({ where: { id: req.params.id } });
        res.redirect('/admin/books');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/books?error=DeleteFailed');
    }
});

router.post('/books/:id/update', async (req, res) => {
    try {
        const book = await Book.findByPk(req.params.id);
        if (book) {
            if (req.body.imageUrl !== undefined) book.imageUrl = req.body.imageUrl;
            if (req.body.category !== undefined) book.category = req.body.category;
            await book.save();
        }
        res.redirect('/admin/books');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/books?error=UpdateFailed');
    }
});

// Job Management
router.get('/jobs', (req, res) => {
    res.render('admin/jobs', { page: 'jobs' });
});

router.post('/jobs/trigger', async (req, res) => {
    const result = await fetchGoogleBooks(req.body.query || 'subject:fiction');
    res.render('admin/jobs', {
        page: 'jobs',
        message: result.success ? `Job Success! Added ${result.added} books.` : `Job Failed: ${result.error}`
    });
});

module.exports = router;
