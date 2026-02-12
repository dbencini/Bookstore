# Speed Up Site: Performance & Search Optimization Guide

This document documents the strategies used to make the bookstore load millions of records in milliseconds.

## 1. Category Page Optimization (The "5-Second Fix")
**Problem**: Category pages were taking 5+ seconds to load for categories with mixed-age books.
**Cause**: The query `ORDER BY books.createdAt DESC` forced MySQL to scan the entire `books` table (4M+ rows) to find matches for a category, because the index `(CategoryId, BookId)` on the join table couldn't be used for sorting by a column in a *different* table (`books`).

**Solution**:
Always sort by the **Join Table's timestamp** when filtering by a relationship.
- **Bad**: `ORDER BY books.createdAt DESC` (Requires join + sort)
- **Good**: `ORDER BY book_category.createdAt DESC` (Uses covered index)

**Result**:
- Query time dropped from **5100ms** to **290ms** (17x speedup).
- Uses index: `idx_category_created_at_desc` on `book_category`.

## 2. Search Engine Optimization (Boolean Mode)
**Problem**: `LIKE %term%` is too slow for 4M+ rows (80s+ load times).
**Solution**: Use MySQL Full-Text Search in **Boolean Mode**.

### Key Tactics:
1.  **Remove Date Sorting**:
    - Sorting 100,000 search results by Date is slow.
    - Sorting by **Relevance** (default in FTS) is instant.
    - *Rule*: specific searches don't need to be sorted by date; relevance is better for users.

2.  **Stopword Mitigation**:
    - Users often search "The Great Gatsby".
    - "The" is a stopword. If you require `+The`, you get 0 results.
    - *Fix*: Strip stopwords from the *mandatory* (`+`) list. query becomes `The +Great +Gatsby` (where "The" is optional).

3.  **Prefix Matching**:
    - Use `*` to match variations (e.g., `mock*` matches "mockingbird").

## 3. Pagination Strategy (Capped Counting)
**Problem**: `SELECT COUNT(*) ...` scans all matches. For broad terms ("love"), this counts 500,000 rows, taking seconds.
**Solution**: **Cap the Count**.
- We only show up to 10 pages of results.
- Query: `SELECT COUNT(*) FROM (SELECT id FROM books ... LIMIT 80) as sub`
- This ensures the count query never takes more than a few milliseconds, even if there are 1M+ real matches.

## 4. Database Indexes
Ensure these core indexes exist:

| Table | Index | Columns | Purpose |
| :--- | :--- | :--- | :--- |
| `books` | `books_is_visible_created_at` | `(isVisible, createdAt)` | Fast homepage/feed loading |
| `books` | `FULLTEXT` | `(title, author)` | Search engine |
| `book_category` | `idx_category_created_at_desc` | `(CategoryId, createdAt)` | Category pages |
| `book_category` | `PRIMARY` | `(id)` | UUID lookups |
