const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const { User } = require('../models');
const router = express.Router();

router.get('/login', (req, res) => {
    res.render('login');
});

router.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/auth/login',
    // failureFlash: true // removed for simplicity for now
}));

// Google Auth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/auth/login' }),
    (req, res) => {
        res.redirect('/');
    }
);

router.get('/register', (req, res) => {
    res.render('register');
});

router.post('/register', async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;
        // Basic validation
        if (!name || !email || !password || !confirmPassword) {
            return res.render('register', { error: 'All fields are required' });
        }
        if (password !== confirmPassword) {
            return res.render('register', { error: 'Passwords do not match' });
        }

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.render('register', { error: 'Email already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        // Find 'Customer' role
        const { UserType } = require('../models');
        const customerRole = await UserType.findOne({ where: { name: 'Customer' } });

        await User.create({
            name,
            email,
            password_hash: passwordHash,
            userTypeId: customerRole ? customerRole.id : null
        });
        res.redirect('/auth/login');
    } catch (err) {
        console.error(err);
        res.render('register', { error: 'Registration failed' });
    }
});

router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

// Forgot Password Stub
router.get('/forgot-password', (req, res) => {
    res.render('forgot-password');
});

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    console.log(`[STUB] Password reset requested for: ${email}`);
    // In real app: generate token, save to DB, send email
    res.render('forgot-password', { message: 'If account exists, email sent (check console)' });
});

module.exports = router;
