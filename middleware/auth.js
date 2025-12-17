module.exports = {
    ensureAuthenticated: function (req, res, next) {
        if (req.isAuthenticated()) {
            return next();
        }
        // Optional: Save original URL to redirect back after login
        // req.session.returnTo = req.originalUrl;
        req.flash('error_msg', 'Please log in to view that resource');
        res.redirect('/auth/login');
    },
    forwardAuthenticated: function (req, res, next) {
        if (!req.isAuthenticated()) {
            return next();
        }
        res.redirect('/');
    }
};
