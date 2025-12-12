const { Category } = require('./models');

async function check() {
    try {
        const count = await Category.count();
        console.log(`Total Categories: ${count}`);
        if (count > 0) {
            const cats = await Category.findAll();
            console.log(cats.map(c => c.name));
        }
    } catch (err) {
        console.error(err);
    }
}

check();
