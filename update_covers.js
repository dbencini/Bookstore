const https = require('https');
const fs = require('fs');
const path = require('path');
const { sequelize, Book } = require('./models');

const books = [
    // Bestsellers
    { title: 'The Thursday Murder Club', isbn: '9780241425442' },
    { title: 'Atomic Habits', isbn: '9780735211292' },
    { title: 'It Ends with Us', isbn: '9781501110368' },
    { title: 'Lessons in Chemistry', isbn: '9780385547345' },
    { title: 'The Seven Husbands of Evelyn Hugo', isbn: '9781501161933' },
    { title: 'Verity', isbn: '9781791392796' },
    // Fiction
    { title: 'The Catcher in the Rye', isbn: '9780316769480' },
    { title: 'The Kite Runner', isbn: '9781594480003' },
    { title: 'Life of Pi', isbn: '9780151008117' },
    { title: 'The Alchemist', isbn: '9780062315007' },
    { title: 'The Midnight Library', isbn: '9780525559474' },
    { title: 'Where the Crawdads Sing', isbn: '9780735219090' },
    // Non-Fiction
    { title: 'Sapiens: A Brief History of Humankind', isbn: '9780062316097' },
    { title: 'Educated', isbn: '9780399590504' },
    { title: 'Becoming', isbn: '9781524763138' },
    { title: 'Thinking, Fast and Slow', isbn: '9780374275631' },
    { title: 'Quiet', isbn: '9780307352156' },
    { title: 'Into the Wild', isbn: '9780385486804' },
    // Classics
    { title: 'The Great Gatsby', isbn: '9780743273565' },
    { title: 'To Kill a Mockingbird', isbn: '9780061120084' },
    { title: 'Pride and Prejudice', isbn: '9781503290563' },
    { title: '1984', isbn: '9780451524935' },
    { title: 'Jane Eyre', isbn: '9780141441146' },
    { title: 'Wuthering Heights', isbn: '9780141439556' },
    // Children's
    { title: 'The Very Hungry Caterpillar', isbn: '9780399226908' },
    { title: 'Harry Potter and the Sorcerer\'s Stone', isbn: '9780590353427' },
    { title: 'Charlotte\'s Web', isbn: '9780061124952' },
    { title: 'Green Eggs and Ham', isbn: '9780394800165' },
    { title: 'Matilda', isbn: '9780142410370' },
    { title: 'The Lion, the Witch and the Wardrobe', isbn: '9780064471046' },
    // Sci-Fi
    { title: 'Dune', isbn: '9780441172719' },
    { title: 'Neuromancer', isbn: '9780441569595' },
    { title: 'Ender\'s Game', isbn: '9780812550702' },
    { title: 'The Martian', isbn: '9780553418026' },
    { title: 'Foundation', isbn: '9780553293357' },
    { title: 'Fahrenheit 451', isbn: '9781451673319' }
];

const downloadImage = (url, filepath) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => { });
            reject(err);
        });
    });
};

async function updateCovers() {
    try {
        await sequelize.sync();
        const coversDir = path.join(__dirname, 'public', 'images', 'covers');
        if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });

        for (const bookInfo of books) {
            const fileName = `${bookInfo.isbn}.jpg`;
            const filePath = path.join(coversDir, fileName);
            const publicPath = `/images/covers/${fileName}`;
            const url = `https://covers.openlibrary.org/b/isbn/${bookInfo.isbn}-L.jpg`;

            console.log(`Downloading cover for ${bookInfo.title}...`);
            try {
                await downloadImage(url, filePath);
                const book = await Book.findOne({ where: { title: bookInfo.title } });
                if (book) {
                    book.imageUrl = publicPath;
                    await book.save();
                    console.log(`Updated ${book.title}`);
                }
            } catch (err) {
                console.error(`Error processing ${bookInfo.title}:`, err.message);
            }
        }
    } catch (error) {
        console.error('Script failed:', error);
    } finally {
        await sequelize.close();
    }
}

updateCovers();
