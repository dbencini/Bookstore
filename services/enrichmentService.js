const axios = require('axios');
const { Book } = require('../models');

class EnrichmentService {
    constructor() {
        this.googleApiKey = process.env.GOOGLE_BOOK_API;
        this.inProgress = new Set();
    }

    enrichBooks(books) {
        if (!this.googleApiKey) return;
        const incompleteBooks = books.filter(book => this.needsEnrichment(book));

        for (const book of incompleteBooks) {
            if (this.inProgress.has(book.id)) continue;
            this.enrichSingleBook(book).catch(err => {
                console.error(`[Enrichment] Error during background task for ${book.title}:`, err.message);
            }).finally(() => {
                this.inProgress.delete(book.id);
            });
        }
    }

    needsEnrichment(book) {
        const hasPlaceholderImage = !book.imageUrl ||
            book.imageUrl.includes('placehold.co') ||
            book.imageUrl.includes('default_cover.svg');

        const hasUnreliableImage = book.imageUrl && (
            book.imageUrl.startsWith('http://') ||
            book.imageUrl.includes('amazon.com') ||
            book.imageUrl.includes('media-amazon.com') ||
            book.imageUrl.includes('openlibrary.org')
        );

        const hasUnknownAuthor = !book.author ||
            book.author.toLowerCase() === 'unknown' ||
            book.author.length < 3;

        const hasNoDescription = !book.description ||
            book.description.trim().length < 50 ||
            book.description.toLowerCase().includes('no description available');

        return hasPlaceholderImage || hasUnreliableImage || hasUnknownAuthor || hasNoDescription;
    }

    /**
     * More robust image validation using GET/Stream to avoid false positives 
     * and bypass some HEAD request blocks.
     */
    async isValidImageUrl(url) {
        try {
            const response = await axios.get(url, {
                timeout: 5000,
                responseType: 'stream',
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            const contentType = response.headers['content-type'];
            const contentLength = parseInt(response.headers['content-length'] || '0');

            // If we have a content-length and it's tiny, reject immediately
            if (contentLength > 0 && contentLength < 1000) {
                response.data.destroy();
                return false;
            }

            // If it's chunked or we're not sure, read a bit of the stream
            return new Promise((resolve) => {
                let totalBytes = 0;
                let resolved = false;

                response.data.on('data', (chunk) => {
                    totalBytes += chunk.length;
                    if (totalBytes > 1000) {
                        if (!resolved) {
                            resolved = true;
                            response.data.destroy();
                            resolve(true); // Large enough
                        }
                    }
                });

                response.data.on('end', () => {
                    if (!resolved) {
                        resolve(totalBytes > 1000); // Only valid if > 1000
                    }
                });

                response.data.on('error', () => {
                    if (!resolved) resolve(false);
                });

                // Timeout safety
                setTimeout(() => {
                    if (!resolved) {
                        response.data.destroy();
                        resolve(totalBytes > 1000);
                    }
                }, 4000);
            });
        } catch (err) {
            return false;
        }
    }

    async isImageMissingOrBlank(book) {
        if (!book.imageUrl || book.imageUrl.includes('placehold.co') || book.imageUrl.includes('default_cover.svg')) return true;
        if (book.imageUrl.startsWith('http://')) return true;
        if (book.imageUrl.includes('openlibrary.org')) {
            // Re-verify OL images because they are often 1x1 pixels
            return !(await this.isValidImageUrl(book.imageUrl));
        }
        return false;
    }

    async enrichSingleBook(book) {
        this.inProgress.add(book.id);

        let changedFields = [];

        try {
            const freshBook = await Book.findByPk(book.id);
            if (!freshBook) return;

            // CLEANSE: If current image is blank/tiny, reset it so we try to find a real one
            const isBlank = await this.isImageMissingOrBlank(freshBook);
            if (isBlank && freshBook.imageUrl && !freshBook.imageUrl.includes('placehold.co') && !freshBook.imageUrl.includes('default_cover.svg')) {
                freshBook.imageUrl = 'https://placehold.co/200x300';
                changedFields.push('cleansed blank image');
            }

            const query = freshBook.isbn ? `isbn:${freshBook.isbn}` : `intitle:${freshBook.title}`;
            const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5&key=${this.googleApiKey}`;
            const response = await axios.get(url, { timeout: 5000 });

            let needsImage = await this.isImageMissingOrBlank(freshBook);

            if (response.data.items && response.data.items.length > 0) {
                for (const item of response.data.items) {
                    const info = item.volumeInfo;
                    const snippet = item.searchInfo ? item.searchInfo.textSnippet : null;

                    // 1. Author Repair (Aggressive: also check for "corrupted" joined names)
                    const currentAuth = freshBook.author ? freshBook.author.toLowerCase() : '';
                    if ((!currentAuth || currentAuth === 'unknown' || currentAuth.length < 4 || currentAuth.includes(', it')) && info.authors && info.authors.length > 0) {
                        const newAuthor = info.authors.join(', ');
                        if (newAuthor !== freshBook.author) {
                            freshBook.author = newAuthor;
                            changedFields.push('author');
                        }
                    }

                    // 2. Description Repair (Check description OR snippet)
                    const currentDesc = freshBook.description ? freshBook.description.toLowerCase() : '';
                    const hasNoDesc = !currentDesc || currentDesc.length < 50 || currentDesc.includes('no description available');
                    if (hasNoDesc) {
                        const bestDesc = info.description || snippet;
                        if (bestDesc && bestDesc.length > 20) {
                            freshBook.description = bestDesc.substring(0, 4000);
                            changedFields.push('description');
                        }
                    }

                    // 3. Image Repair
                    if (needsImage && info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail)) {
                        let newUrl = (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail).replace('http://', 'https://');
                        if (await this.isValidImageUrl(newUrl)) {
                            freshBook.imageUrl = newUrl;
                            changedFields.push('image');
                            needsImage = false; // Image found, no longer needs image
                        }
                    }
                }
            }

            // Open Library Fallback
            const stillNeedsImage = await this.isImageMissingOrBlank(freshBook);
            if (stillNeedsImage && freshBook.isbn) {
                const olUrl = `https://covers.openlibrary.org/b/isbn/${freshBook.isbn}-L.jpg`;
                if (await this.isValidImageUrl(olUrl)) {
                    freshBook.imageUrl = olUrl;
                    changedFields.push('image (OL)');
                }
            }

            if (changedFields.length > 0) {
                // Force updatedAt update and save
                freshBook.changed('updatedAt', true);
                await freshBook.save();

                // CRITICAL: Sync the original memory object (which might be in a cache)
                Object.assign(book, freshBook.get({ plain: true }));
                console.log(`[Enrichment] Successfully repaired ${freshBook.title}: [${changedFields.join(', ')}]`);
            } else {
                // Mark as checked so we don't spam API
                freshBook.changed('updatedAt', true);
                await freshBook.save();

                // Also update memory object so cache knows it's "Checked"
                Object.assign(book, freshBook.get({ plain: true }));
                console.log(`[Enrichment] Checked ${freshBook.title} - no new data.`);
            }

        } catch (err) {
            console.error(`[Enrichment] Error processing ${book.title}:`, err.message);
            throw err;
        }
    }
}

module.exports = new EnrichmentService();
