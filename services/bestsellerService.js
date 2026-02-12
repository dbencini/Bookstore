const axios = require('axios');
const cheerio = require('cheerio');

class BestsellerService {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    /**
     * Fetch New York Times Best Sellers (API)
     */
    async getNYTBestsellers(apiKey, listName = 'hardcover-fiction') {
        if (!apiKey) {
            console.warn('[NYT] API Key is missing. Skipping NYT fetch.');
            return [];
        }
        try {
            const url = `https://api.nytimes.com/svc/books/v3/lists/current/${listName}.json?api-key=${apiKey}`;
            const response = await axios.get(url, { timeout: 10000 });
            return response.data.results.books.map(book => ({
                rank: book.rank,
                title: book.title,
                author: book.author,
                isbn: book.primary_isbn13,
                description: book.description,
                image: book.book_image ? book.book_image.replace('http://', 'https://') : null,
                source: 'NYT'
            }));
        } catch (error) {
            console.error(`[NYT] Error: ${error.message}`);
            return [];
        }
    }

    /**
     * Fetch Bestsellers using Google Books API (Alternative for Amazon/BN)
     */
    async getGoogleBestsellers(apiKey, category = 'fiction') {
        if (!apiKey) {
            console.warn('[Google] API Key is missing. Skipping Google fetch.');
            return [];
        }
        try {
            const url = `https://www.googleapis.com/books/v1/volumes?q=subject:${category}&orderBy=newest&maxResults=20&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 10000 });
            if (!response.data.items) return [];

            return response.data.items.map((item, i) => ({
                rank: i + 1,
                title: item.volumeInfo.title,
                author: item.volumeInfo.authors ? item.volumeInfo.authors.join(', ') : 'Unknown',
                isbn: item.volumeInfo.industryIdentifiers ? item.volumeInfo.industryIdentifiers[0].identifier : null,
                description: item.volumeInfo.description,
                image: (item.volumeInfo.imageLinks && (item.volumeInfo.imageLinks.thumbnail || item.volumeInfo.imageLinks.smallThumbnail))
                    ? (item.volumeInfo.imageLinks.thumbnail || item.volumeInfo.imageLinks.smallThumbnail).replace('http://', 'https://')
                    : null,
                source: 'Google Books'
            }));
        } catch (error) {
            console.error(`[Google] Error: ${error.message}`);
            return [];
        }
    }

    /**
     * Scrape Amazon Best Sellers (Scraping - Fragile)
     */
    async getAmazonBestsellers() {
        console.log('[Amazon] Attempting to scrape...');
        try {
            const url = 'https://www.amazon.com/Best-Sellers-Books/zgbs/books/';
            const { data } = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9'
                },
                timeout: 10000
            });
            const $ = cheerio.load(data);
            const books = [];

            $('.p13n-gridItem').each((i, el) => {
                if (i >= 20) return false;
                const title = $(el).find('div._cDE4f_p13n-sc-css-line-clamp-1_1p59L').text().trim() ||
                    $(el).find('.p13n-sc-truncate-desktop-type2').text().trim();
                const author = $(el).find('._cDE4f_p13n-sc-css-line-clamp-1_1p59L').next('.a-row').text().trim();
                const img = $(el).find('img').attr('src');
                const rank = $(el).find('.zg-bdg-text').text().replace('#', '').trim();

                if (title) {
                    books.push({ rank: parseInt(rank) || i + 1, title, author, image: img, source: 'Amazon' });
                }
            });

            if (books.length === 0 && data.includes('api-services-support@amazon.com')) {
                console.warn('[Amazon] Scraping blocked by anti-bot measures.');
            }
            return books;
        } catch (error) {
            console.error(`[Amazon] Error: ${error.message}`);
            return [];
        }
    }

    /**
     * Scrape Barnes & Noble Best Sellers (Scraping - Fragile)
     */
    async getBNBestsellers() {
        console.log('[BN] Attempting to scrape...');
        try {
            const url = 'https://www.barnesandnoble.com/b/books/_/N-29Z8q8';
            const { data } = await axios.get(url, {
                headers: { 'User-Agent': this.userAgent },
                timeout: 15000
            });
            const $ = cheerio.load(data);
            const books = [];

            $('.product-shelf-tile').each((i, el) => {
                if (i >= 20) return false;
                const title = $(el).find('.product-info-title a').text().trim();
                const author = $(el).find('.product-info-author a').text().trim();
                const img = $(el).find('img.main-product-image').attr('src');
                if (title) {
                    books.push({ rank: i + 1, title, author, image: img, source: 'Barnes & Noble' });
                }
            });
            return books;
        } catch (error) {
            console.error(`[BN] Error: ${error.message}`);
            return [];
        }
    }

    /**
     * Aggregate Bestsellers from all sources
     */
    async getAllBestsellers(configs = {}) {
        const [amazon, nyt, bn, google] = await Promise.all([
            this.getAmazonBestsellers(),
            this.getNYTBestsellers(configs.nytApiKey),
            this.getBNBestsellers(),
            this.getGoogleBestsellers(configs.googleApiKey)
        ]);

        return {
            amazon,
            nyt,
            bn,
            google,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new BestsellerService();
