# Bestseller Category System

This document explains the technical implementation of the automated **Bestseller** category.

## 1. Data Sources

The system aggregates titles from multiple global sources to ensure a diverse and accurate list:

*   **New York Times Books API (Primary)**: Fetches official bestseller lists (e.g., Hardcover Fiction).
*   **Google Books API (Secondary)**: Retrieves top-ranked volumes by subject/category.
*   **Scraping Infrastructure**: Contains logic for Amazon and Barnes & Noble (currently limited by anti-bot measures but available for future proxy integration).

## 2. Automated Sync Logic

The list is refreshed daily via a background process.

### The Cron Job
A `node-cron` job is scheduled in `server.js` to trigger the sync script every day at **midnight**:
```javascript
cron.schedule('0 0 * * *', () => {
    // Executes node scripts/fetch_bestsellers.js
});
```

### The Synchronization Process (`scripts/fetch_bestsellers.js`)
1.  **Aggregation**: The script fetches the top 20–50 books from each active API.
2.  **Database Matching**: The system **only** displays books that you already have in your local inventory. It matches the fetched ISBNs against the `books` table.
3.  **Category Cleanup**: Before updating, it clears all existing links in the "Bestseller" category to ensure the list is strictly current.
4.  **Linking**: Verified matches are linked to the `Bestseller` category in the `BookCategory` join table.

## 3. UI Display

*   **Priority Ranking**: The "Bestseller" category is assigned a `priority` value of `100` in the database, ensuring it always appears first in the navigation bar.
*   **Default Landing**: The homepage route (`/books`) is configured to default to the `Bestseller` category if no other filter is selected.

## 4. Manual Update

To force an immediate refresh of the bestseller list without waiting for the midnight cron:
```bash
node scripts/fetch_bestsellers.js
```

---
*Last Updated: 2026-02-11 | Integrated with NYT and Google Books APIs*
