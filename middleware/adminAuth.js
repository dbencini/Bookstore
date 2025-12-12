const { UserType } = require('../models');

async function requireAdmin(req, res, next) {
    if (!req.isAuthenticated()) {
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.status(401).json({ success: false, error: 'Unauthorized: Please log in again.' });
        }
        return res.redirect('/auth/login');
    }

    // Check if user has 'Admin' user type
    try {
        if (!req.user.userTypeId) {
            if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
                return res.status(403).json({ success: false, error: 'Access Denied: No Role Assigned' });
            }
            return res.status(403).render('error', { message: 'Access Denied: No Role Assigned' });
        }

        const userType = await UserType.findByPk(req.user.userTypeId);
        if (userType && userType.name === 'Admin') {
            return next();
        } else {
            if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
                return res.status(403).json({ success: false, error: 'Access Denied: Admins Only' });
            }
            return res.status(403).render('error', { message: 'Access Denied: Admins Only' });
        }
    } catch (err) {
        console.error(err);
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.status(500).json({ success: false, error: 'Server Error' });
        }
        return res.status(500).send('Server Error');
    }
}

module.exports = requireAdmin;
