require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const { sequelize, User, UserType, SiteConfig } = require('./models');
const expressLayouts = require('express-ejs-layouts');
const adminRoutes = require('./routes/admin');
const { startCronJob } = require('./services/bookService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
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
    } catch (err) {
        console.error('Error loading site config:', err);
        res.locals.siteConfig = { appName: 'Fallback POD' };
    }
    next();
});

// Middleware to pass user details to views
app.use((req, res, next) => {
    res.locals.user = req.user;
    res.locals.title = res.locals.siteConfig ? res.locals.siteConfig.appName : 'Bookstore';
    next();
});

// Routes
const authRoutes = require('./routes/auth');
const indexRoutes = require('./routes/index');
const cartRoutes = require('./routes/cart');

app.use('/auth', authRoutes);
app.use('/', indexRoutes);
app.use('/cart', cartRoutes);
app.use('/admin', adminRoutes);

app.get('/', (req, res) => {
    res.redirect('/books');
});

// Sync database and start server
sequelize.sync().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        startCronJob();
        console.log(`Debug URL: http://localhost:${PORT}/?cb=${Date.now()}`);
    });
}).catch(err => {
    console.error('Database sync failed:', err);
});
