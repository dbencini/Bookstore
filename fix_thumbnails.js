const { sequelize, Book } = require('./models');
const { Op } = require('sequelize');

async function fixThumbnails() {
    try {
        console.log('Fixing thumbnails...');
        const result = await Book.update(
            { imageUrl: '/images/default_cover.svg' },
            {
                where: {
                    imageUrl: { [Op.like]: '%via.placeholder.com%' }
                }
            }
        );
        console.log(`Updated ${result[0]} books.`);

        // Also catch the one I just made if it used a different domain or just in case
        const result2 = await Book.update(
            { imageUrl: '/images/default_cover.svg' },
            {
                where: {
                    imageUrl: { [Op.like]: '%placehold.co%' } // Just in case I used this mentally or in previous steps
                }
            }
        );
        if (result2[0] > 0) console.log(`Updated ${result2[0]} other placeholders.`);

    } catch (err) {
        console.error('Error fixing thumbnails:', err);
    } finally {
        await sequelize.close();
    }
}

fixThumbnails();
