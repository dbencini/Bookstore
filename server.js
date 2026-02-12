require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const { sequelize, User, UserType, SiteConfig, Category, FooterSetting } = require('./models');
const expressLayouts = require('express-ejs-layouts');
const adminRoutes = require('./routes/admin');
const { fetchGoogleBooks } = require('./services/bookService');
const cron = require('node-cron');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use((req, res, next) => {
    if (req.method === 'POST') {
        //  console.log(`[Global Debug] POST ${req.url}`, req.body);
        //  console.log(`[Global Debug] Headers: Accept=${req.headers.accept}, X-Requested-With=${req.headers['x-requested-with']}`);
    }

    res.on('finish', () => {
        if (req.method === 'POST') {
            //    console.log(`[Global Debug] Response Status: ${res.statusCode} Content-Type: ${res.get('Content-Type')}`);
        }
    });
    next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(expressLayouts);
app.set('view engine', 'ejs');

// Session Setup
app.use(session({
    store: new SQLiteStore({ db: 'sessions.sqlite', dir: '.' }),
    secret: 'your_secret_key', // In prod, use ENV
    resave: false,
    saveUninitialized: false
}));

// Passport Config
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    console.log(`[Auth] Attempting login for ${email}`);
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            console.log('[Auth] User not found');
            return done(null, false, { message: 'Incorrect email.' });
        }
        if (!user.validPassword(password)) {
            console.log('[Auth] Invalid password');
            return done(null, false, { message: 'Incorrect password.' });
        }
        console.log('[Auth] Login successful');
        return done(null, user);
    } catch (err) {
        console.error('[Auth] Error:', err);
        return done(err);
    }
}));

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `http://localhost:${PORT}/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // 1. Check if user exists by Google ID
        let user = await User.findOne({ where: { googleId: profile.id } });
        if (user) return done(null, user);

        // 2. Check if user exists by Email (link accounts)
        if (profile.emails && profile.emails.length > 0) {
            const email = profile.emails[0].value;
            user = await User.findOne({ where: { email } });
            if (user) {
                user.googleId = profile.id;
                await user.save();
                return done(null, user);
            }

            // 3. Create new user
            user = await User.create({
                googleId: profile.id,
                email: email,
                name: profile.displayName
            });
            return done(null, user);
        }
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findByPk(id, { include: UserType });
        done(null, user);
    } catch (err) {
        done(err);
    }
});

app.use(passport.initialize());
app.use(passport.session());

// Middleware to pass user and site config to views
app.use(async (req, res, next) => {
    try {
        let config = await SiteConfig.findOne();
        if (!config) {
            console.log('SiteConfig Not Found, Creating...');
            config = await SiteConfig.create({ appName: 'My Bookstore', theme: 'light' });
        }
        res.locals.siteConfig = config;
        res.locals.appName = config.appName || 'My Bookstore';
        // Ensure logoUrl references /images/ if it's just a filename
        let logo = config.logoUrl || '/images/logo_v2.svg';
        if (logo && !logo.startsWith('/images/') && !logo.startsWith('http')) {
            logo = '/images/' + logo;
        }
        res.locals.appLogo = logo;

        const themeColor = config.themeColor || '#0d6efd';
        res.locals.themeColor = themeColor;

        // Compute RGB for Bootstrap variables (cleaner than doing it in EJS)
        try {
            const hex = themeColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            res.locals.themeColorRgb = `${r}, ${g}, ${b}`;
        } catch (e) {
            res.locals.themeColorRgb = '13, 110, 253';
        }

        // Fetch Categories for Global Menu (Sorted by Priority)
        let categories = [];
        try {
            categories = await Category.findAll({ order: [['priority', 'DESC'], ['name', 'ASC']], timeout: 5000 });
        } catch (catErr) {
            console.error('Failed to fetch categories for menu:', catErr.message);
        }
        res.locals.categories = categories;
    } catch (err) {
        console.error('Error loading site config:', err.stack || err);
        res.locals.siteConfig = { appName: 'Fallback POD' };
        res.locals.appName = 'My Bookstore';
        res.locals.appLogo = '/images/logo_v2.svg';
    }
    next();
});

// Middleware to pass user details to views
app.use(async (req, res, next) => {
    res.locals.user = req.user;
    res.locals.title = res.locals.siteConfig ? res.locals.siteConfig.appName : 'Bookstore';
    res.locals.cartCount = 0; // Default

    if (req.user) {
        try {
            const { CartItem } = require('./models');
            const count = await CartItem.sum('quantity', { where: { UserId: req.user.id } });
            res.locals.cartCount = count || 0;
        } catch (err) {
            console.error('Error fetching cart count:', err);
        }
    }

    try {
        let footerSettings = await FooterSetting.findOne();
        if (!footerSettings) {
            footerSettings = await FooterSetting.create({});
        }
        res.locals.footerSettings = footerSettings;
    } catch (err) {
        console.error('Error loading footer settings:', err);
        res.locals.footerSettings = {};
    }

    next();
});

// Routes
const authRoutes = require('./routes/auth');
const indexRoutes = require('./routes/index');
const cartRoutes = require('./routes/cart');

app.use('/auth', authRoutes);
app.get('/theme.css', (req, res) => {
    res.set('Content-Type', 'text/css');
    res.render('theme-css', { layout: false });
});
app.use('/', indexRoutes);
app.use('/cart', cartRoutes);
app.use('/admin', adminRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[Global Error Handler]', err.stack || err);
    res.status(500).send('Internal Server Error: ' + err.message);
});

app.get('/', (req, res) => {
    res.redirect('/books');
});

// Sync database and start server
app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Debug URL: http://localhost:${PORT}/?cb=${Date.now()}`);

    // Schedule Daily Bestseller Sync (At midnight)
    // Schedule Daily Bestseller Sync (At midnight)
    cron.schedule('0 0 * * *', () => {
        console.log('[Cron] Running daily bestseller sync...');
        exec('node scripts/fetch_bestsellers.js', (error, stdout, stderr) => {
            if (error) {
                console.error(`[Cron] Error: ${error.message}`);
                return;
            }
            if (stderr) console.error(`[Cron] Stderr: ${stderr}`);
            console.log(`[Cron] Stdout: ${stdout}`);
        });
    });
});

// Schedule Admin Counts Update (Every 15 minutes)
cron.schedule('*/15 * * * *', () => {
    console.log('[Cron] Updating Admin Dashboard Counts...');
    exec('node scripts/update_admin_counts.js', (error, stdout, stderr) => {
        if (error) {
            console.error(`[Cron] Error: ${error.message}`);
            return;
        }
        // if (stderr) console.error(`[Cron] Stderr: ${stderr}`); // Helper adds noise
        console.log(`[Cron] Stats Updated: ${stdout.trim()}`);
    });
});

// Run once on startup (after 10s delay)
setTimeout(() => {
    console.log('[Startup] trigger initial admin count update...');
    exec('node scripts/update_admin_counts.js');
}, 10000);
// }).catch(err => {
//     console.error('Database sync failed:', err);
// });
