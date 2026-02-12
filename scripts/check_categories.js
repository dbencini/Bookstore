const { Category } = require('../models');

async function check() {
    try {
        const categories = await Category.findAll();
        console.log('Current Categories:');
        categories.forEach(c => console.log(`- ${c.name} (ID: ${c.id})`));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
