const { UserType } = require('../models');

async function requireAdmin(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.redirect('/auth/login');
    }

    // Check if user has 'Admin' user type
    try {
        if (!req.user.userTypeId) {
            return res.status(403).render('error', { message: 'Access Denied: No Role Assigned' });
        }

        const userType = await UserType.findByPk(req.user.userTypeId);
        if (userType && userType.name === 'Admin') {
            return next();
        } else {
            return res.status(403).render('error', { message: 'Access Denied: Admins Only' });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).send('Server Error');
    }
}

module.exports = requireAdmin;
