const { Book } = require('./models');

async function updateBookSchema() {
    try {
        console.log('Updating Book table schema...');
        await Book.sync({ alter: true });
        console.log('Book table schema updated successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error updating Book table:', error);
        process.exit(1);
    }
}

updateBookSchema();
