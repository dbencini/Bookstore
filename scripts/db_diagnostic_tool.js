require('dotenv').config();
const { sequelize } = require('../models');
const axios = require('axios');

async function run() {
    const action = process.argv[2];

    try {
        switch (action) {
            case 'monitor':
                const [waits] = await sequelize.query(`
                    SELECT blocking_trx_rows_modified 
                    FROM sys.innodb_lock_waits 
                    WHERE blocking_pid = 239
                `);
                if (waits.length > 0) {
                    console.log(`STATUS:ROLLBACK_IN_PROGRESS:${waits[0].blocking_trx_rows_modified}`);
                } else {
                    const [plist] = await sequelize.query('SHOW FULL PROCESSLIST');
                    const zombie = plist.find(p => p.Id === 239);
                    if (zombie) {
                        console.log(`STATUS:ZOMBIE_ALIVE:${zombie.Time}:${zombie.State}`);
                    } else {
                        console.log('STATUS:CLEARED');
                    }
                }
                break;

            case 'check_isbn':
                const isbn = process.argv[3];
                const [isbnBooks] = await sequelize.query(`SELECT id, title, author, price, imageUrl, description, updatedAt FROM books WHERE isbn = '${isbn}'`);
                console.log(`STATUS:FOUND:${isbnBooks.length}`);
                isbnBooks.forEach(b => {
                    console.log(`BOOK:ID=${b.id}:URL=${b.imageUrl}:AUTH=${b.author}:UPDATED=${b.updatedAt}`);
                });
                break;

            case 'test_openlibrary':
                const olIsbn = process.argv[3];
                const urlOl = `https://openlibrary.org/api/books?bibkeys=ISBN:${olIsbn}&format=json&jscmd=data`;
                try {
                    const res = await axios.get(urlOl);
                    console.log('STATUS:OL_RESULT');
                    console.log(JSON.stringify(res.data, null, 2));
                } catch (err) {
                    console.error('STATUS:OL_ERROR:' + err.message);
                }
                break;

            case 'test_image_validation':
                const imgUrl = process.argv[3];
                const enServiceTest = require('../services/enrichmentService');

                try {
                    const response = await axios.get(imgUrl, {
                        timeout: 5000,
                        responseType: 'stream',
                        headers: { 'Range': 'bytes=0-1024' }
                    });
                    console.log(`STATUS:CODE=${response.status}`);
                    console.log(`STATUS:HEADERS=${JSON.stringify(response.headers, null, 2)}`);

                    const isValid = await enServiceTest.isValidImageUrl(imgUrl);
                    console.log(`STATUS:IS_VALID_BY_SERVICE=${isValid}`);
                } catch (err) {
                    console.error('STATUS:ERROR:' + err.message);
                }
                break;

            case 'test_raw_get':
                const rawUrl = process.argv[3];
                try {
                    const res = await axios.get(rawUrl);
                    console.log('STATUS:RAW_GET_RESULT');
                    console.log(`STATUS:CODE=${res.status}`);
                    console.log(`STATUS:HEADERS=${JSON.stringify(res.headers, null, 2)}`);
                    console.log(`STATUS:DATA_LENGTH=${res.data.length || (res.data && res.data.length)}`);
                } catch (err) {
                    console.error('STATUS:RAW_GET_ERROR:' + err.message);
                }
                break;

            case 'check_category':
                const bookId = process.argv[3];
                const [cats] = await sequelize.query(`SELECT c.name FROM category c JOIN book_category bc ON c.id = bc.CategoryId WHERE bc.BookId = '${bookId}'`);
                console.log(`STATUS:CATEGORIES:${cats.map(c => c.name).join(', ')}`);
                break;

            case 'check_bestsellers':
                const [best] = await sequelize.query(`SELECT b.id, b.title, b.author, b.isbn FROM books b JOIN book_category bc ON b.id = bc.BookId JOIN category c ON c.id = bc.CategoryId WHERE c.name = 'Bestseller' AND b.title LIKE '%Five Children%'`);
                console.log('STATUS:BESTSELLERS');
                console.log(JSON.stringify(best, null, 2));
                break;

            case 'search_title':
                const searchTitle = process.argv[3];
                const [titleMatches] = await sequelize.query(`SELECT id, title, author, isbn, isVisible, updatedAt FROM books WHERE title LIKE '%${searchTitle}%'`);
                console.log(`STATUS:FOUND:${titleMatches.length}`);
                titleMatches.forEach(b => {
                    console.log(`BOOK:ID=${b.id}:ISBN=${b.isbn}:AUTH=${b.author}:VISIBLE=${b.isVisible}:UPDATED=${b.updatedAt}`);
                });
                break;

            case 'run_enrichment':
                const enrichmentISBN = process.argv[3];
                const { Book: BookModel } = require('../models');
                const enService = require('../services/enrichmentService');
                const targetBook = await BookModel.findOne({ where: { isbn: enrichmentISBN } });
                if (!targetBook) {
                    console.error('STATUS:NOT_FOUND');
                    break;
                }
                console.log(`BEFORE: Auth="${targetBook.author}" Img="${targetBook.imageUrl}"`);
                try {
                    await enService.enrichSingleBook(targetBook);
                    console.log(`AFTER: Auth="${targetBook.author}" Img="${targetBook.imageUrl}"`);
                    console.log(`UPDATED_AT: ${targetBook.updatedAt}`);
                } catch (err) {
                    console.error('STATUS:ERROR:' + err.message);
                }
                break;

            case 'show_book':
                const id_or_isbn = process.argv[3];
                const [matches] = await sequelize.query(`SELECT * FROM books WHERE isbn = '${id_or_isbn}' OR id = '${id_or_isbn}'`);
                console.log('STATUS:DETAILS');
                console.log(JSON.stringify(matches, null, 2));
                break;

            case 'test_enrichment':
                const query = process.argv[3];
                const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${query}&key=${process.env.GOOGLE_BOOK_API}`;
                try {
                    const res = await axios.get(url);
                    console.log('STATUS:API_RESULT');
                    console.log(JSON.stringify(res.data, null, 2));
                } catch (err) {
                    console.error('STATUS:API_ERROR:' + err.message);
                }
                break;

            case 'swap_status':
                const [[{ cnt: newCnt }]] = await sequelize.query('SELECT COUNT(*) as cnt FROM books_new');
                const [[{ cnt: oldCnt }]] = await sequelize.query('SELECT COUNT(*) as cnt FROM books');
                console.log(`STATUS:COUNTS:books=${oldCnt}:books_new=${newCnt}`);
                break;

            default:
                console.log('Unknown action');
        }
        process.exit(0);
    } catch (e) {
        console.error('DIAG_ERROR:', e.message);
        process.exit(1);
    }
}

run();
