const express = require('express');
// Global Count Cache (identical to routes/index.js)
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

const router = express.Router();
const { sequelize, User, UserType, Book, Category, Job, FooterSetting, Order, OrderNote, Workshop, OrderItem, OrderSource, CpOrderItem, CpOrder, CpFile, CpAddress, SiteConfig, Op } = require('../models');

// Book Management

// ...

// Book Management
// Middleware Imports
const requireAdmin = require('../middleware/adminAuth');
const { fetchGoogleBooks, fixBookData, fastAuthorRepair, importBooksFromCSV, importManualZip, stopJob, pauseJob, resumeJob } = require('../services/bookService');
const { repairAuthorsStable, stopJob: stopStableJob, pauseJob: pauseStableJob, resumeJob: resumeStableJob } = require('../repair_authors_stable');
const bcrypt = require('bcrypt');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');

// Apply Auth Middleware Globally to this Router
router.use(requireAdmin);

// Apply Auth Middleware Globally to this Router
router.use(requireAdmin);

// GET /workshop - View all workshop tasks (Placed top to avoid conflicts)
router.get('/workshop', async (req, res) => {
    try {
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
            whereClause['$OrderItem.Order.id$'] = { [Op.like]: `% ${orderId}% ` };
        }

        if (search) {
            // Advanced Search: Match Book Title/ISBN OR Order ID
            // We use top-level where with included columns
            whereClause[Op.and] = [
                {
                    [Op.or]: [
                        { '$OrderItem.Book.title$': { [Op.like]: `% ${search}% ` } },
                        { '$OrderItem.Book.isbn$': { [Op.like]: `% ${search}% ` } },
                        { '$OrderItem.Order.id$': { [Op.like]: `% ${search}% ` } }
                    ]
                }
            ];
        }

        const { source } = req.query;
        let sourceWhere = {};
        if (source && source !== 'All') {
            sourceWhere = { name: source };
        }

        const { count, rows } = await Workshop.findAndCountAll({
            where: whereClause,
            distinct: true,
            limit,
            offset,
            subQuery: false, // Required for association filtering
            order: [['createdAt', 'ASC']], // User Req: Order Date ASC
            include: [
                { model: OrderSource, where: sourceWhere },
                {
                    model: OrderItem,
                    required: false, // Make this optional so we can see CloudPrint items too
                    include: [
                        { model: Book },
                        { model: Order }
                    ]
                },
                {
                    model: CpOrderItem,
                    required: false,
                    include: [
                        { model: CpOrder },
                        { model: CpFile } // To get the files
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
            sourceFilter: source || 'All',
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
    try {
        const userCount = await User.count();
        const visibleBookCount = await getGlobalCount();
        const totalBookCount = await Book.count();
        const adminCount = await User.count({
            include: { model: UserType, where: { name: 'Admin' } }
        });

        res.render('admin/dashboard', {
            userCount,
            bookCount: visibleBookCount,
            totalBookCount,
            visibleBookCount,
            adminCount,
            page: 'dashboard'
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Dashboard Error');
    }
});

// User Management
router.get('/users', async (req, res) => {
    try {
        const { page = 1, search = '', typeId = '' } = req.query;
        const limit = 20;
        const offset = (page - 1) * limit;

        const { Sequelize } = require('../models');

        // Build Filter
        const where = {};
        if (search) {
            const lowerSearch = search.toLowerCase();
            where[Op.or] = [
                Sequelize.where(
                    Sequelize.fn('lower', Sequelize.col('User.name')),
                    'LIKE',
                    `% ${lowerSearch}% `
                ),
                Sequelize.where(
                    Sequelize.fn('lower', Sequelize.col('User.email')),
                    'LIKE',
                    `% ${lowerSearch}% `
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
        // Helper to sanitize incoming query strings (handles literal "undefined" from faulty links)
        const sanitize = (val) => {
            if (val === undefined || val === null || val === 'undefined' || val === 'null') return null;
            return val.trim();
        };

        const title = sanitize(req.query.title);
        const author = sanitize(req.query.author);
        const category = sanitize(req.query.category);
        const isbn = sanitize(req.query.isbn);
        const startDate = sanitize(req.query.startDate);
        const endDate = sanitize(req.query.endDate);
        const page = parseInt(req.query.page) || 1;

        const limit = 12;
        const offset = (page - 1) * limit;

        const where = {};

        // Quick Filter Support for Missing Data
        const quickFilter = sanitize(req.query.filter);
        let isQuickFilter = false;

        if (quickFilter) {
            isQuickFilter = true;
            switch (quickFilter) {
                case 'missing_author':
                    // Uses idx_books_author_prefix_updated_at
                    where.author = { [Op.or]: [null, '', 'Unknown'] };
                    break;
                case 'missing_image':
                    // Simplified: Pattern check showed 0 matches for placeholders. 
                    // Focusing on NULL/Empty for performance using idx_books_image_prefix_updated_at
                    where.imageUrl = { [Op.or]: [null, ''] };
                    break;
                case 'missing_title':
                    // Uses idx_books_title_prefix_updated_at
                    where.title = { [Op.or]: [null, ''] };
                    break;
                case 'missing_description':
                    // Uses idx_books_description_prefix_updated_at
                    where.description = { [Op.or]: [null, '', 'No description available.'] };
                    break;
                case 'missing_price':
                    // Uses idx_books_price_updated_at
                    where.price = { [Op.or]: [null, 0] };
                    break;
                case 'incomplete':
                    where.isVisible = false;
                    break;
            }
        }

        // Detect if any search filter is active
        const isSearching = !!(title || author || category || isbn || startDate || endDate || isQuickFilter);
        const isCategorySearch = !!category;

        if (isSearching) {
            // Admin can see ALL books - no visibility filtering
            if (title) where.title = { [Op.like]: `%${title}%` };
            if (author) where.author = { [Op.like]: `%${author}%` };
            if (isbn) {
                const cleanIsbn = isbn.replace(/[-\s]/g, '');
                where.isbn = cleanIsbn;
            }

            // Date Range Search with validation
            if (startDate || endDate) {
                const dateFilter = {};
                if (startDate) {
                    const start = new Date(startDate);
                    if (!isNaN(start.getTime())) {
                        dateFilter[Op.gte] = start;
                    }
                }
                if (endDate) {
                    const end = new Date(endDate);
                    if (!isNaN(end.getTime())) {
                        end.setHours(23, 59, 59, 999);
                        dateFilter[Op.lte] = end;
                    }
                }
                if (Object.keys(dateFilter).length > 0) {
                    where.createdAt = dateFilter;
                }
            }
        }
        // REMOVED: Image filter - admins should see all books including those without images

        // Optimization: Only include Category in the main query if searching by it
        // Join-based filtering on 5M rows is expensive, but necessary for specific category search.
        if (isCategorySearch) {
            const cat = await Category.findOne({ where: { name: category } });
            if (cat) {
                // Use join table for filtering
                where.id = {
                    [Op.in]: sequelize.literal(`(SELECT BookId FROM book_category WHERE CategoryId = '${cat.id}')`)
                };
            } else {
                where.id = '00000000-0000-0000-0000-000000000000';
            }
        }

        if (!isSearching) {
            // High-performance path: Use Index Hint + Cached/Optimized Count
            count = await getGlobalCount();
            rows = await sequelize.query(`
                SELECT * FROM books USE INDEX (books_is_visible_updated_at)
                WHERE isVisible = true 
                ORDER BY updatedAt DESC 
                LIMIT :limit OFFSET :offset
            `, {
                replacements: { limit, offset },
                type: sequelize.QueryTypes.SELECT,
                model: Book,
                mapToModel: true
            });
        } else {
            // Searching/Filtering path

            // Optimization: Use cached count for Quick Filters to avoid expensive COUNT(*) query
            let usedCachedCount = false;
            if (isQuickFilter) {
                try {
                    const siteConfig = await SiteConfig.findOne({ attributes: ['adminDashboardStats'] });
                    if (siteConfig && siteConfig.adminDashboardStats && siteConfig.adminDashboardStats.filters) {
                        const cachedVal = siteConfig.adminDashboardStats.filters[quickFilter];
                        if (cachedVal !== undefined) {
                            count = cachedVal;
                            usedCachedCount = true;
                        }
                    }
                } catch (configErr) {
                    console.error('Failed to load cached stats:', configErr);
                }
            }

            if (!usedCachedCount) {
                count = await Book.count({ where });
            }

            rows = await Book.findAll({
                where,
                limit,
                offset,
                order: [['updatedAt', 'DESC']]
            });
        }

        if (rows.length > 0) {
            const bookIds = rows.map(b => b.id);
            const categoriesForBooks = await Category.findAll({
                include: [{
                    model: Book,
                    where: { id: bookIds },
                    attributes: ['id'],
                    through: { attributes: [] }
                }]
            });

            const categoryMap = {};
            categoriesForBooks.forEach(cat => {
                cat.Books.forEach(book => {
                    if (!categoryMap[book.id]) categoryMap[book.id] = [];
                    categoryMap[book.id].push(cat);
                });
            });

            rows.forEach(book => {
                book.Categories = categoryMap[book.id] || [];
            });
        }

        // Fetch all categories for combobox in Edit modal
        const categories = await Category.findAll({ order: [['name', 'ASC']] });
        const totalPages = Math.ceil(count / limit);

        res.render('admin/books', {
            books: rows,
            totalBooks: count,
            categories,
            page: 'books',
            currentPage: parseInt(page),
            totalPages,
            filters: {
                title: title || '',
                author: author || '',
                category: category || '',
                isbn: isbn || '',
                startDate: startDate || '',
                endDate: endDate || ''
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Category Matching API (for Google Books fetch)
router.post('/books/match-categories', async (req, res) => {
    try {
        const { subjects } = req.body;

        if (!subjects || !Array.isArray(subjects)) {
            return res.json({ success: false, error: 'Invalid subjects array' });
        }

        // Get all categories with their subject_triggers
        const allCategories = await Category.findAll({
            attributes: ['id', 'name', 'subject_triggers']
        });

        const matchedCategoryIds = [];

        // For each subject from Google Books, check against category triggers
        for (const subject of subjects) {
            const subjectLower = subject.toLowerCase().trim();

            for (const category of allCategories) {
                if (!category.subject_triggers) continue;

                // Parse comma-separated triggers
                const triggers = category.subject_triggers
                    .split(',')
                    .map(t => t.toLowerCase().trim())
                    .filter(t => t.length > 0);

                // Check if any trigger matches this subject
                for (const trigger of triggers) {
                    if (subjectLower.includes(trigger) || trigger.includes(subjectLower)) {
                        if (!matchedCategoryIds.includes(category.id)) {
                            matchedCategoryIds.push(category.id);
                        }
                        break;
                    }
                }
            }
        }

        // If no matches, return empty array (don't auto-add to "New Books")
        res.json({
            success: true,
            categoryIds: matchedCategoryIds,
            matchCount: matchedCategoryIds.length
        });
    } catch (err) {
        console.error('Category matching error:', err);
        res.status(500).json({ success: false, error: err.message });
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
            const { categoryId, price, price_cost, imageUrl, stock, description, isVisible, isbn } = req.body;


            if (req.body.categoryIds) {
                const catIds = Array.isArray(req.body.categoryIds) ? req.body.categoryIds : [req.body.categoryIds];
                await book.setCategories(catIds);
            }

            if (price) book.price = parseFloat(price);
            if (price_cost) book.price_cost = parseFloat(price_cost); // Add Cost Price support
            if (imageUrl) book.imageUrl = imageUrl;
            if (isbn) book.isbn = isbn;

            if (stock !== undefined && stock !== '') {
                const stockVal = parseInt(stock, 10);
                if (!isNaN(stockVal)) book.stock = stockVal;
            }

            if (description !== undefined) book.description = description;

            // Enforce visibility rules: Hide if no description or placeholder author
            const hasDescription = book.description && book.description.trim() !== '' && book.description !== 'No description available.';
            const hasAuthor = book.author && book.author !== 'Unknown' && book.author.trim() !== '';

            if (!hasDescription || !hasAuthor) {
                book.isVisible = false;
            } else {
                // Checkbox handling: likely 'on' if checked, undefined if unchecked
                book.isVisible = (isVisible === 'on');
            }

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

// Job Status Polling
router.get('/api/jobs/:id/status', async (req, res) => {
    try {
        const job = await Job.findByPk(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });

        let status = job.status;
        const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

        // Check for stale "running" jobs
        if (status === 'running' && (Date.now() - new Date(job.updatedAt).getTime() > STALE_THRESHOLD)) {
            status = 'stalled';
        }

        res.json({
            status: status,
            progress: job.progress || 0,
            summary: job.summary,
            booksAdded: job.booksAdded,
            startTime: job.startTime,
            updatedAt: job.updatedAt,
            type: job.type,
            fixedCount: job.fixedCount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/master-author-stats', async (req, res) => {
    try {
        const { OpenLibraryAuthor, IsbnAuthorMapping } = require('../models');
        const [authorCount, mappingCount] = await Promise.all([
            OpenLibraryAuthor.count(),
            IsbnAuthorMapping.count()
        ]);
        res.json({ success: true, authorCount, mappingCount });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
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
        let result = await stopJob(req.params.id);

        // If not successful/found in BookService, try Stable Repair
        if (!result || !result.success) {
            const stableResult = await stopStableJob(req.params.id);
            if (stableResult && stableResult.success) {
                result = stableResult;
            }
        }

        if (result && result.success) {
            // Wait briefly for the loop to break
            await new Promise(r => setTimeout(r, 600));
        }
        res.redirect('/admin/jobs');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/jobs?error=StopFailed');
    }
});

// Import Books Management
router.get('/import', async (req, res) => {
    res.render('admin/import', {
        page: 'import',
        success: req.query.success,
        error: req.query.error,
        added: req.query.added
    });
});

router.post('/import/delete-all', async (req, res) => {
    try {
        await Book.destroy({ where: {}, truncate: false }); // Truncate: false is safer with SQLite
        res.redirect('/admin/import?success=AllBooksDeleted');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/import?error=DeleteAllFailed');
    }
});

router.post('/import/csv', upload.single('csvFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const markup = req.body.markup || 0;
        const result = await importBooksFromCSV(req.file.path, markup, req.file.originalname);

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Import failed: ' + err.message });
    }
});

router.post('/import/manual-zip', async (req, res) => {
    try {
        const markup = req.body.markup || 0;
        const result = await importManualZip(markup);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Manual import failed: ' + err.message });
    }
});

router.get('/api/jobs', async (req, res) => {
    try {
        const { status, limit = 10 } = req.query;
        const where = {};
        if (status) where.status = status;

        const jobs = await Job.findAll({
            where,
            limit: parseInt(limit),
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, jobs });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/import/fix-thumbnails', async (req, res) => {
    try {
        const result = await fixBookData();
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Repair job failed: ' + err.message });
    }
});

// Fast Author-Only Repair (STABLE VERSION - resumable, low memory)
router.post('/import/fast-author-repair', async (req, res) => {
    try {
        const { repairAuthorsStable } = require('../repair_authors_stable');

        // Start stable repair in background
        repairAuthorsStable().catch(err => {
            console.error('[Admin] Author repair error:', err);
        });

        // Small delay to ensure job is created
        await new Promise(resolve => setTimeout(resolve, 500));

        // Get the most recent RUNNING author_repair_stable job
        const job = await Job.findOne({
            where: {
                type: 'author_repair_stable',
                status: 'running'
            },
            order: [['id', 'DESC']]
        });

        res.json({
            success: true,
            jobId: job ? job.id : null
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Check Hidden Books and Update Visibility
router.post('/import/check-hidden-books', async (req, res) => {
    try {
        console.log('[Admin] Checking hidden books for visibility eligibility...');

        let checked = 0;
        let updated = 0;
        let pricesFixed = 0;
        let lastId = '00000000-0000-0000-0000-000000000000';
        const BATCH_SIZE = 1000;

        while (true) {
            // Fetch batch using cursor pagination to avoid OOM
            const hiddenBooks = await Book.findAll({
                where: {
                    isVisible: false,
                    id: { [Op.gt]: lastId }
                },
                order: [['id', 'ASC']],
                limit: BATCH_SIZE,
                attributes: ['id', 'title', 'author', 'price', 'price_cost', 'imageUrl', 'isVisible']
            });

            if (hiddenBooks.length === 0) break;

            for (const book of hiddenBooks) {
                checked++;
                let needsSave = false;

                // Check if price is missing but cost_price exists
                if ((!book.price || parseFloat(book.price) === 0) && book.price_cost && parseFloat(book.price_cost) > 0) {
                    book.price = (parseFloat(book.price_cost) * 1.15).toFixed(2);
                    pricesFixed++;
                    needsSave = true;
                }

                // Check if book qualifies for visibility
                const hasImage = book.imageUrl &&
                    book.imageUrl !== '' &&
                    !book.imageUrl.includes('placeholder');
                const hasAuthor = book.author &&
                    book.author !== '' &&
                    book.author !== 'Unknown';
                const hasTitle = book.title && book.title !== '';
                const hasPrice = book.price && parseFloat(book.price) > 0;

                // Make visible if all criteria met
                if (hasImage && hasAuthor && hasTitle && hasPrice) {
                    book.isVisible = true;
                    updated++;
                    needsSave = true;
                }

                if (needsSave) {
                    await book.save();
                }

                lastId = book.id;
            }

            // Optional: Log progress every 10 batches
            if (checked % 10000 === 0) {
                console.log(`[Admin] Checked ${checked} hidden books...`);
                if (global.gc) global.gc(); // Hint GC if exposed
            }
        }

        console.log(`[Admin] Hidden books check complete: ${updated} made visible, ${pricesFixed} prices fixed, ${checked} total checked`);

        res.json({
            success: true,
            checked,
            updated,
            pricesFixed
        });
    } catch (err) {
        console.error('[Admin] Error checking hidden books:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/repair/dump-status', async (req, res) => {


    try {
        const path = require('path');
        const fs = require('fs');
        const dumpPath = path.join(__dirname, '../uploads/ol_dump_editions.txt.gz');

        if (fs.existsSync(dumpPath)) {
            const stats = fs.statSync(dumpPath);
            return res.json({
                exists: true,
                size: stats.size,
                sizeLabel: (stats.size / 1024 / 1024 / 1024).toFixed(2) + ' GB'
            });
        }
        res.json({ exists: false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/import/ultimate-repair', async (req, res) => {
    try {
        const { startUltimateRepair } = require('../services/bookService');
        const result = await startUltimateRepair();
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Ultimate repair failed: ' + err.message });
    }
});

router.get('/jobs/:id/status', async (req, res) => {
    try {
        const job = await Job.findByPk(req.params.id);
        if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
        res.json({
            success: true,
            status: job.status,
            progress: job.progress,
            summary: job.summary,
            type: job.type,
            processedCount: job.processedCount,
            fixedCount: job.fixedCount,
            removedCount: job.removedCount
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/jobs/:id/pause', async (req, res) => {
    try {
        const { pauseJob } = require('../services/bookService');
        const result = await pauseJob(req.params.id);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/jobs/:id/resume', async (req, res) => {
    try {
        const { resumeJob } = require('../services/bookService');
        const result = await resumeJob(req.params.id);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/jobs/:id/stop', async (req, res) => {
    try {
        const { stopJob } = require('../services/bookService');
        const result = await stopJob(req.params.id);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});


router.get('/repair/stats', async (req, res) => {
    try {
        const [total, hasAuthor, hasDesc, hasThumb, hasCost, hasSale, categories] = await Promise.all([
            Book.count(),
            Book.count({ where: { author: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }, { [Op.ne]: 'Unknown' }] } } }),
            Book.count({ where: { description: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }, { [Op.ne]: 'No description available.' }] } } }),
            Book.count({ where: { imageUrl: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }, { [Op.ne]: '/images/placeholder-book.png' }, { [Op.ne]: 'https://placehold.co/200x300' }] } } }),
            Book.count({ where: { price_cost: { [Op.gt]: 0 } } }),
            Book.count({ where: { price: { [Op.gt]: 0 } } }),
            // Fetch category counts
            Category.findAll({
                attributes: ['id', 'name', 'book_count'],
                order: [['book_count', 'DESC']]
            })
        ]);

        res.json({
            success: true,
            stats: {
                total,
                hasAuthor,
                hasDesc,
                hasThumb,
                hasCost,
                hasSale,
                missingAuthor: total - hasAuthor,
                missingDesc: total - hasDesc,
                missingThumb: total - hasThumb
            },
            categories: categories.map(c => ({ name: c.name, count: c.book_count || 0 }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/repair/stats/examples', async (req, res) => {
    try {
        const { category } = req.query;
        let where = {};

        switch (category) {
            case 'hasAuthor': where = { author: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }, { [Op.ne]: 'Unknown' }] } }; break;
            case 'missingAuthor': where = { [Op.or]: [{ author: null }, { author: '' }, { author: 'Unknown' }] }; break;
            case 'hasDesc': where = { description: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }, { [Op.ne]: 'No description available.' }] } }; break;
            case 'missingDesc': where = { [Op.or]: [{ description: null }, { description: '' }, { description: 'No description available.' }] }; break;
            case 'hasThumb': where = { imageUrl: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }, { [Op.ne]: '/images/placeholder-book.png' }, { [Op.ne]: 'https://placehold.co/200x300' }] } }; break;
            case 'missingThumb': where = { [Op.or]: [{ imageUrl: null }, { imageUrl: '' }, { imageUrl: '/images/placeholder-book.png' }, { [Op.ne]: 'https://placehold.co/200x300' }] }; break;
            case 'hasCost': where = { price_cost: { [Op.gt]: 0 } }; break;
            case 'hasSale': where = { price: { [Op.gt]: 0 } }; break;
        }

        const books = await Book.findAll({
            where,
            limit: 5,
            attributes: ['id', 'title', 'author', 'isbn', 'price', 'price_cost', 'imageUrl'],
            order: [['createdAt', 'DESC']]
        });

        res.json({ success: true, books });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/repair/stats/category-examples', async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) {
            return res.status(400).json({ success: false, error: 'Category name is required' });
        }

        // Find the category
        const category = await Category.findOne({ where: { name } });
        if (!category) {
            return res.json({ success: true, books: [] });
        }

        // Find books in this category
        const books = await Book.findAll({
            attributes: ['id', 'title', 'author', 'isbn', 'price', 'price_cost', 'imageUrl', 'createdAt'],
            include: [{
                model: Category,
                where: { id: category.id },
                attributes: [],
                through: { attributes: [] }
            }],
            limit: 10,
            order: [['createdAt', 'DESC']]
        });

        res.json({ success: true, books });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
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
        const { appName, logoUrl, facebookUrl, twitterUrl, instagramUrl, linkedinUrl, youtubeUrl, sandboxPayfast, sandboxCloudPrint } = req.body;

        // Update SiteConfig
        let settings = await SiteConfig.findOne();
        if (!settings) settings = await SiteConfig.create({});

        settings.appName = appName;
        settings.logoUrl = logoUrl;
        settings.sandboxPayfast = (sandboxPayfast === 'on');
        settings.sandboxCloudPrint = (sandboxCloudPrint === 'on');
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

// CloudPrinter Order Details
router.get('/cloudprinter/order-details/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const order = await CpOrder.findByPk(id, {
            include: [
                { model: CpAddress },
                {
                    model: CpOrderItem,
                    include: [
                        { model: CpFile },
                        { model: Workshop }
                    ]
                }
            ]
        });

        if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

        // Parse extra details from fullJsonPayload
        let extra = {};
        try {
            if (order.fullJsonPayload) {
                const payload = JSON.parse(order.fullJsonPayload);
                // Depending on structure (sometimes wrapped in "order" key, sometimes not)
                const root = payload.order || payload;
                extra = {
                    shipping: root.shipping,
                    priority: root.priority,
                    client: root.client,
                    rawItems: root.items // Contains options which we might need
                };
            }
        } catch (e) {
            console.warn('Failed to parse fullJsonPayload', e);
        }

        res.json({ success: true, order, extra });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// CloudPrinter File Operations
router.post('/cloudprinter/download-file', async (req, res) => {
    try {
        const { cpFileId } = req.body;
        const file = await CpFile.findByPk(cpFileId, {
            include: [
                { model: CpOrder },
                {
                    model: CpOrderItem,
                    include: [{ model: CpOrder }]
                }
            ]
        });

        if (!file) return res.status(404).json({ success: false, error: 'File not found' });

        const orderNo = file.CpOrder ? file.CpOrder.cpOrderId :
            (file.CpOrderItem && file.CpOrderItem.CpOrder ? file.CpOrderItem.CpOrder.cpOrderId : 'Unknown');

        // Simulate downloading to a "hotfolder"
        const fs = require('fs');
        const path = require('path');
        const hotfolder = path.join(__dirname, '../public/hotfolder');

        if (!fs.existsSync(hotfolder)) {
            fs.mkdirSync(hotfolder, { recursive: true });
        }

        // Mock Download: In real life, use axios to stream file.url to destination
        // Here we just create a dummy file
        const fileName = `${file.type}_${file.id}.pdf`;
        const destPath = path.join(hotfolder, fileName);

        // Create a minimal valid PDF (1.7) so browsers don't complain
        const pdfContent = `% PDF - 1.7
1 0 obj
    << /Type /Catalog / Pages 2 0 R >>
        endobj
2 0 obj
    << /Type /Pages / Kids[3 0 R] /Count 1 >>
endobj
3 0 obj
    << /Type /Page / Parent 2 0 R / MediaBox[0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
    << /Length 59 >>
stream
BT
    / F1 24 Tf
50 700 Td
    (Dummy File: ${file.type} for Order No ${orderNo}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000060 00000 n
0000000117 00000 n
0000000216 00000 n
trailer
    << /Size 5 /Root 1 0 R >>
        startxref
325
    %% EOF`;
        fs.writeFileSync(destPath, Buffer.from(pdfContent));

        // Save local path
        file.localPath = destPath;
        await file.save();

        res.json({ success: true, message: 'File downloaded to hotfolder', localPath: fileName });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/cloudprinter/delete-file', async (req, res) => {
    try {
        const { cpFileId } = req.body;
        const file = await CpFile.findByPk(cpFileId);

        if (!file || !file.localPath) return res.status(404).json({ success: false, error: 'File or local path not found' });

        const fs = require('fs');
        if (fs.existsSync(file.localPath)) {
            fs.unlinkSync(file.localPath);
            file.localPath = null;
            await file.save();
            res.json({ success: true, message: 'File deleted from hotfolder' });
        } else {
            // It might have been deleted manually
            file.localPath = null;
            await file.save();
            res.json({ success: true, message: 'File record updated (file was missing)' });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
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
                // Determine status - if currently 'Pending' or 'Processing', mark as Shipped in fulfillment
                const order = fullWorkshop.OrderItem.Order;
                if (order.fulfillmentStatus !== 'shipped') {
                    order.fulfillmentStatus = 'shipped';
                    await order.save();
                    orderCompleted = true;
                    completedOrderId = orderId;
                    console.log(`Order ${orderId} auto - marked as Shipped.`);
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
            console.log(`[CRM - EMAIL - STUB] Sending email to Customer of Order ${req.params.id}: "${content}"`);
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

        const where = {};
        if (search) {
            where.name = { [Op.like]: `% ${search}% ` };
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

router.get('/repair/google-huge-file/sample', async (req, res) => {
    try {
        const path = require('path');
        const fs = require('fs');
        const readline = require('readline');
        const filePath = path.join(__dirname, '../uploads/OpenLibraryBooks.txt');

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'OpenLibraryBooks.txt not found in uploads directory.' });
        }

        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        const rows = [];
        let count = 0;

        for await (const line of rl) {
            if (count >= 10) break;
            const columns = line.split('\t');
            rows.push(columns);
            count++;
        }

        rl.close();
        fileStream.destroy();

        res.json({ success: true, rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Fast Author Repair (Local Dump - Stable)
router.post('/import/fast-author-repair', async (req, res) => {
    try {
        // Run in background
        repairAuthorsStable().catch(err => console.error(err));
        // Small delay to allow job creation
        await new Promise(r => setTimeout(r, 1000));
        res.redirect('/admin/import?success=AuthorRepairStarted');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/import?error=RepairFailed');
    }
});

// Repair Stats (JSON)
router.get('/repair/stats', async (req, res) => {
    try {
        const [total, hasAuthor, hasDesc, hasThumb, hasCost, hasSale, categories] = await Promise.all([
            Book.count(),
            Book.count({ where: { author: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }, { [Op.ne]: 'Unknown' }] } } }),
            Book.count({ where: { description: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }, { [Op.ne]: 'No description available.' }] } } }),
            Book.count({ where: { imageUrl: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }, { [Op.ne]: '/images/placeholder-book.png' }, { [Op.ne]: 'https://placehold.co/200x300' }] } } }),
            Book.count({ where: { price_cost: { [Op.gt]: 0 } } }),
            Book.count({ where: { price: { [Op.gt]: 0 } } }),
            Category.findAll({
                attributes: ['id', 'name', 'book_count'],
                order: [['book_count', 'DESC']]
            })
        ]);

        res.json({
            success: true,
            stats: {
                total,
                hasAuthor,
                hasDesc,
                hasThumb,
                hasCost,
                hasSale,
                missingAuthor: total - hasAuthor,
                missingDesc: total - hasDesc,
                missingThumb: total - hasThumb
            },
            categories: categories.map(c => ({ name: c.name, count: c.book_count || 0 }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
