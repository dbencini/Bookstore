require('dotenv').config();
const { sequelize, Book, SiteConfig, Op } = require('../models');

async function updateAdminCounts() {
    try {
        console.log('Starting Admin Counts Update...');
        const startTotal = Date.now();

        // 1. Total Books
        const totalBooks = await Book.count();

        // 2. Missing Data Counts
        // Use parallel promises for speed where possible, but be mindful of DB load
        const [
            missingAuthor,
            missingImage,
            missingTitle,
            missingDescription,
            missingPrice,
            incomplete
        ] = await Promise.all([
            Book.count({ where: { [Op.or]: [{ author: null }, { author: '' }, { author: 'Unknown' }] } }),
            Book.count({ where: { [Op.or]: [{ imageUrl: null }, { imageUrl: '' }, { imageUrl: { [Op.like]: '%placehold.co%' } }] } }),
            Book.count({ where: { [Op.or]: [{ title: null }, { title: '' }, { title: 'Unknown' }] } }),
            Book.count({ where: { [Op.or]: [{ description: null }, { description: '' }, { description: 'No description available.' }] } }),
            Book.count({ where: { [Op.or]: [{ price: null }, { price: 0 }] } }),
            Book.count({ where: { isVisible: false } })
        ]);

        const stats = {
            totalBooks,
            filters: {
                missing_author: missingAuthor,
                missing_image: missingImage,
                missing_title: missingTitle,
                missing_description: missingDescription,
                missing_price: missingPrice,
                incomplete: incomplete
            },
            updatedAt: new Date()
        };

        console.log('Stats Calculated:', stats);

        // 3. Save to SiteConfig
        let config = await SiteConfig.findOne();
        if (!config) {
            config = await SiteConfig.create({ appName: 'My Bookstore' });
        }

        config.adminDashboardStats = stats;
        await config.save();

        console.log(`Counts updated successfully in ${Date.now() - startTotal}ms`);

    } catch (err) {
        console.error('Update failed:', err);
    } finally {
        if (require.main === module) {
            await sequelize.close();
        }
    }
}

if (require.main === module) {
    updateAdminCounts();
}

module.exports = updateAdminCounts;
