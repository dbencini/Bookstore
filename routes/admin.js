const express = require('express');
const router = express.Router();
const { User, UserType, Book, Category, Job, FooterSetting, Order, OrderNote, Workshop, OrderItem } = require('../models');
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

// Apply Auth Middleware Globally to this Router
router.use(requireAdmin);

// GET /workshop - View all workshop tasks (Placed top to avoid conflicts)
router.get('/workshop', async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const { search, page = 1, showIncomplete, orderId } = req.query;
        const limit = 12;
        const offset = (page - 1) * limit;

        const whereClause = {};
        // const includeBookWhere = {}; // This is no longer needed with the new search logic

        // Filter: Show Incomplete (Default to true if undefined, false only if explicitly 'false')
        // User Requirement: "set by default each time the page is visited"
        const isIncompleteFilter = showIncomplete !== 'false';

        if (isIncompleteFilter) {
            // Explicitly include false OR null to be safe across SQL dialects
            whereClause[Op.or] = [
                { threeKnife: { [Op.is]: null } },
                { threeKnife: false },
                { dispatch: { [Op.is]: null } },
                { dispatch: false }
            ];
        }

        if (orderId) {
            whereClause['$OrderItem.Order.id$'] = { [Op.like]: `%${orderId}%` };
        }

        if (search) {
            // Advanced Search: Match Book Title/ISBN OR Order ID
            // We use top-level where with included columns
            whereClause[Op.and] = [
                {
                    [Op.or]: [
                        { '$OrderItem.Book.title$': { [Op.like]: `%${search}%` } },
                        { '$OrderItem.Book.isbn$': { [Op.like]: `%${search}%` } },
                        { '$OrderItem.Order.id$': { [Op.like]: `%${search}%` } }
                    ]
                }
            ];
        }

        const { count, rows } = await Workshop.findAndCountAll({
            where: whereClause,
            distinct: true,
            limit,
            offset,
            subQuery: false, // Required for association filtering
            order: [['createdAt', 'ASC']], // User Req: Order Date ASC
            include: [
                {
                    model: OrderItem,
                    required: true,
                    include: [
                        { model: Book },
                        { model: Order }
                    ]
                }
            ]
        });

        const viewData = {
            title: 'Workshop Tasks',
            workshops: rows,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit),
            totalItems: count,
            searchQuery: search || '',
            orderIdQuery: orderId || '',
            showIncomplete: isIncompleteFilter,
            user: req.user
        };

        if (req.query.ajax) {
            return res.render('admin/partials/workshop-grid', { ...viewData, layout: false });
        }

        res.render('admin/workshop', viewData);
    } catch (err) {
        console.error('Error fetching workshop tasks:', err);
        res.status(500).render('error', { message: 'Error loading workshop tasks', error: err });
    }
});

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
            order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']]
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
        const { page = 1, title, author, category, isbn, startDate, endDate } = req.query;
        const limit = 12;
        const offset = (page - 1) * limit;
        const { Op } = require('sequelize');

        // Build Where Clause
        const where = {};
        const include = [];

        if (title) where.title = { [Op.like]: `%${title}%` };
        if (title) where.title = { [Op.like]: `%${title}%` };
        if (author) where.author = { [Op.like]: `%${author}%` };
        if (isbn) where.isbn = { [Op.like]: `%${isbn}%` };

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
            order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']]
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
            filters: { title, author, category, isbn, startDate, endDate }
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
            const { categoryId, price, imageUrl, stock, description, isVisible, isbn } = req.body;
            console.log('[DEBUG] Update Body:', req.body);
            console.log('[DEBUG] Received Description:', description);

            if (categoryId) book.categoryId = categoryId;
            if (price) book.price = parseFloat(price);
            if (imageUrl) book.imageUrl = imageUrl;
            if (isbn) book.isbn = isbn;

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

// Combined Settings Management
router.get('/settings', async (req, res) => {
    try {
        const { SiteConfig, FooterSetting } = require('../models');

        // Load App Config
        let settings = await SiteConfig.findOne();
        if (!settings) settings = await SiteConfig.create({ appName: 'My Bookstore', theme: 'light' });

        // Load Footer Settings
        let footer = await FooterSetting.findOne();
        if (!footer) footer = await FooterSetting.create({});

        res.render('admin/settings', {
            page: 'settings',
            settings,
            footer,
            success: req.query.success,
            error: req.query.error
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/settings', async (req, res) => {
    try {
        const { SiteConfig, FooterSetting } = require('../models');
        const { appName, logoUrl, facebookUrl, twitterUrl, instagramUrl, linkedinUrl, youtubeUrl } = req.body;

        // Update SiteConfig
        let settings = await SiteConfig.findOne();
        if (!settings) settings = await SiteConfig.create({});

        settings.appName = appName;
        settings.logoUrl = logoUrl;
        await settings.save();

        // Update FooterSetting
        let footer = await FooterSetting.findOne();
        if (!footer) footer = await FooterSetting.create({});

        footer.facebookUrl = facebookUrl;
        footer.twitterUrl = twitterUrl;
        footer.instagramUrl = instagramUrl;
        footer.linkedinUrl = linkedinUrl;
        footer.youtubeUrl = youtubeUrl;
        await footer.save();

        res.redirect('/admin/settings?success=true');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/settings?error=' + encodeURIComponent(err.message));
    }
});



// Order Management (CRM)
router.get('/orders', async (req, res) => {
    try {
        const { page = 1, status, fulfillment } = req.query;
        const limit = 12;
        const offset = (page - 1) * limit;
        const { Op } = require('sequelize');

        const where = {};
        if (status) where.status = status;
        if (fulfillment) where.fulfillmentStatus = fulfillment;

        const { count, rows } = await Order.findAndCountAll({
            where,
            include: [
                { model: User, attributes: ['name', 'email'] }
            ],
            limit,
            offset,
            order: [['createdAt', 'DESC']]
        });

        // Calculate stats for top counters
        const pendingCount = await Order.count({ where: { status: 'pending' } });
        const unfulfilledCount = await Order.count({ where: { fulfillmentStatus: 'unfulfilled', status: 'completed' } });

        const totalPages = Math.ceil(count / limit);

        res.render('admin/orders', {
            orders: rows,
            totalOrders: count,
            pendingCount,
            unfulfilledCount,
            page: 'orders',
            currentPage: parseInt(page),
            totalPages,
            filters: { status, fulfillment }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.get('/orders/:id/details', async (req, res) => {
    try {
        const { OrderItem, Workshop, Book } = require('../models');
        const order = await Order.findByPk(req.params.id, {
            include: [
                { model: User, attributes: ['name', 'email'] },
                {
                    model: OrderNote,
                    include: [{ model: User, attributes: ['name'] }],
                    order: [['createdAt', 'DESC']]
                },
                {
                    model: OrderItem,
                    include: [
                        { model: Book, attributes: ['title', 'isbn'] },
                        { model: Workshop } // Include Workshop details
                    ]
                }
            ]
        });

        if (!order) return res.status(404).json({ error: 'Order not found' });

        res.json(order);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// [NEW] Workshop Update
router.post('/workshop/update', async (req, res) => {
    try {
        const { Workshop, OrderItem, Order } = require('../models'); // Ensure Workshop is imported here
        const { workshopId, field, value } = req.body; // field: 'threeKnife' or 'dispatch'

        const workshop = await Workshop.findByPk(workshopId);
        if (!workshop) return res.status(404).json({ success: false, error: 'Workshop record not found' });

        if (field === 'threeKnife') workshop.threeKnife = value;
        if (field === 'dispatch') workshop.dispatch = value;

        // Update timestamps
        if (value) {
            if (field === 'threeKnife') workshop.threeKnifeDate = new Date();
            if (field === 'dispatch') workshop.dispatchDate = new Date();
        } else {
            if (field === 'threeKnife') workshop.threeKnifeDate = null;
            if (field === 'dispatch') workshop.dispatchDate = null;
        }

        await workshop.save();

        let orderCompleted = false;
        let completedOrderId = null;

        // check if parent order is fully complete
        const fullWorkshop = await Workshop.findByPk(workshopId, {
            include: [{
                model: OrderItem,
                include: [Order]
            }]
        });

        if (fullWorkshop && fullWorkshop.OrderItem && fullWorkshop.OrderItem.Order) {
            const orderId = fullWorkshop.OrderItem.Order.id;

            // Get all items for this order
            const orderItems = await OrderItem.findAll({
                where: { OrderId: orderId },
                include: [Workshop]
            });

            // Check if ALL items have BOTH 3-knife and dispatch checked
            const allComplete = orderItems.every(item => {
                const ws = item.Workshop;
                return ws && ws.threeKnife === true && ws.dispatch === true;
            });

            if (allComplete) {
                // Determine status - if currently 'Pending' or 'Processing', move to 'Shipped'
                const order = fullWorkshop.OrderItem.Order;
                if (order.status !== 'Shipped' && order.status !== 'Cancelled') {
                    order.status = 'Shipped';
                    await order.save();
                    orderCompleted = true;
                    completedOrderId = orderId;
                    console.log(`Order ${orderId} auto-marked as Shipped.`);
                }
            }
        }

        res.json({ success: true, workshop, orderCompleted, completedOrderId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/orders/:id/status', async (req, res) => {
    try {
        const { fulfillmentStatus } = req.body;
        const order = await Order.findByPk(req.params.id);

        if (order) {
            order.fulfillmentStatus = fulfillmentStatus;
            await order.save();
            return res.json({ success: true, fulfillmentStatus: order.fulfillmentStatus });
        }
        res.status(404).json({ success: false, error: 'Order not found' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/orders/:id/note', async (req, res) => {
    try {
        const { content, emailCustomer } = req.body;
        if (!content) return res.status(400).json({ error: 'Content required' });

        const note = await OrderNote.create({
            OrderId: req.params.id,
            UserId: req.user.id, // Admin User
            content,
            isCustomerVisible: !!emailCustomer
        });

        if (emailCustomer) {
            console.log(`[CRM-EMAIL-STUB] Sending email to Customer of Order ${req.params.id}: "${content}"`);
            // In future: await emailService.send(...)
        }

        // Return note with author name for UI injection
        const noteWithAuthor = await OrderNote.findByPk(note.id, {
            include: [{ model: User, attributes: ['name'] }]
        });

        res.json({ success: true, note: noteWithAuthor });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Category Maintenance
router.get('/categories', async (req, res) => {
    try {
        const { page = 1, search = '' } = req.query;
        const limit = 12;
        const offset = (page - 1) * limit;
        const { Op } = require('sequelize');

        const where = {};
        if (search) {
            where.name = { [Op.like]: `%${search}%` };
        }

        const { count, rows } = await Category.findAndCountAll({
            where,
            limit,
            offset,
            order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']]
        });

        const totalPages = Math.ceil(count / limit);

        res.render('admin/categories', {
            categories: rows,
            totalCategories: count,
            page: 'categories',
            currentPage: parseInt(page),
            totalPages,
            search
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Category Update/Create Routes (Minimal Implementation for Modal)
router.post('/categories/create', async (req, res) => {
    try {
        await Category.create({ name: req.body.name });
        res.redirect('/admin/categories');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/categories?error=CreateFailed');
    }
});

router.post('/categories/:id/update', async (req, res) => {
    try {
        const category = await Category.findByPk(req.params.id);
        if (category) {
            category.name = req.body.name;
            await category.save();
        }
        res.redirect('/admin/categories');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/categories?error=UpdateFailed');
    }
});

router.post('/categories/:id/delete', async (req, res) => {
    try {
        await Category.destroy({ where: { id: req.params.id } });
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.json({ success: true });
        }
        res.redirect('/admin/categories');
    } catch (err) {
        console.error(err);
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.redirect('/admin/categories?error=DeleteFailed');
    }
});

module.exports = router;
