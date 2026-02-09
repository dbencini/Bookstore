# Searching and Paging Optimization Guide

This document details the high-performance search and pagination strategies implemented for the **4.9 Million record** bookstore database. These optimizations reduced search latencies from **81 seconds** to **133 milliseconds**.

## 1. The Challenge
Searching millions of records in a traditional SQL database using `LIKE %term%` or standard `NATURAL LANGUAGE` Full-Text Search (FTS) is often too slow for production because:
1.  **Broad Matches**: Searching for common words returns hundreds of thousands of records.
2.  **Date Sorting**: Forcing a `ORDER BY createdAt DESC` on millions of matches requires the DB to sort massive result sets before returning the first 8 rows.
3.  **Total Counts**: Standard pagination requires a `COUNT(*)` of all matches, which is expensive on large indices.

## 2. High-Performance Architecture

### A. Boolean Mode with Wildcards
Instead of natural language, we use MySQL **BOOLEAN MODE**.
*   **Pattern**: `+term1* +term2*`
*   **Benefit**: The `+` makes words mandatory (and matching), and the `*` allows for prefix matching (e.g., "mocking" matches "mockingbird"). This significantly narrows the search space compared to "any word" matching.

### B. Stopword Mitigation
MySQL has a default list of **stopwords** (e.g., "the", "with", "about", "for") that are **not indexed**.
*   **The Problem**: If you search for `+Odyssey* +with* +Animals*`, MySQL returns **0 results** because "with" is a stopword.
*   **The Solution**: We identify common stopwords and remove the mandatory `+` prefix for them.
*   **Final Query**: `+Odyssey* with* +Animals*`. This ensures the search works even if the user includes common prepositions.

### C. Relevance-First Search (No Date Sort)
We removed `ORDER BY createdAt DESC` for keyword searches.
*   **Why?**: Sorting 50,000 "bird" matches by date takes ~30 seconds.
*   **Benefit**: Full-Text Search has a built-in "Relevance Score". By removing the date sort, MySQL can return the top relevant matches instantly using the index.
*   **Note**: We keep the Date Sort for the **Browsing** view (homepage/categories) where the results are pre-filtered and indexed by `isVisible_createdAt`.

### D. Capped Counting (Pagination Stability)
Calculating total pages for 100,000 matches is slow and often unnecessary for a search engine.
*   **The Fix**: We cap the counting query using a subquery with `LIMIT 80`.
```sql
SELECT COUNT(*) as count FROM (
    SELECT id FROM books 
    WHERE isVisible = true 
    AND MATCH(title, author) AGAINST(:search IN BOOLEAN MODE)
    LIMIT 80
) as sub
```
*   **Result**: The UI shows a maximum of **10 pages** of search results. This ensures that even the most "broad" search remains sub-second, protecting the server from hanging.

## 3. Implementation Reference (`routes/index.js`)

The core logic is encapsulated in `performSearch`:

1.  **ISBN Check**: Fast path for exact ISBN lookups.
2.  **Term Building**: 
    - Strip special characters.
    - Identify mandatory terms (length >= 3 and not in stopword list).
    - Construct the Boolean query.
3.  **Execution**: Run the `LIMIT` query first.
4.  **Capped Count**: Provide pagination data without scanning the whole index.

## 4. Performance Benchmarks

| Query Type | Original (Natural Mode) | Optimized (Smart Boolean) | Speedup |
| :--- | :--- | :--- | :--- |
| **Specific** ("Mockingbird") | ~1,100ms | **112ms** | 10x |
| **Common/Broad** ("Odyssey with Animals") | **81,600ms** | **133ms** | **613x** |
| **ISBN** ("9780312611934") | ~500ms | **57ms** | 9x |

---

*Last Updated: February 2026*
