require('dotenv').config();
const { sequelize, Op, Book } = require('../models');

async function checkImagePatterns() {
    try {
        console.log('Checking Image URL Patterns...');

        const patterns = [
            '%placehold.co%',
            'https://placehold.co%',
            '%default_cover.svg%',
            '%placeholder-book.png%'
        ];

        for (const pattern of patterns) {
            const count = await sequelize.query(`
                SELECT COUNT(*) as count FROM books WHERE imageUrl LIKE :pattern
            `, {
                replacements: { pattern },
                type: sequelize.QueryTypes.SELECT
            });
            console.log(`Pattern '${pattern}': ${count[0].count}`);
        }

        const nullCount = await Book.count({ where: { imageUrl: null } });
        console.log(`NULL imageUrl: ${nullCount}`);

        const emptyCount = await Book.count({ where: { imageUrl: '' } });
        console.log(`Empty imageUrl: ${emptyCount}`);

        const samples = await Book.findAll({
            where: { imageUrl: { [Op.ne]: null } },
            limit: 5,
            attributes: ['imageUrl']
        });
        console.log('Sample imageUrls:', samples.map(b => b.imageUrl));

    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        await sequelize.close();
    }
}

checkImagePatterns();
