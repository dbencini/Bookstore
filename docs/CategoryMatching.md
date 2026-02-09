# Category Matching & Filtering System

This document outlines the modernized categorization architecture and the public-facing book filtering logic.

## 1. Data Architecture

The system has transitioned from a legacy JSON-based subject field to a modern **Many-to-Many** relationship.

### Core Models
- **Book**: The main entity. No longer contains `subjectIdsJson`.
- **Category**: Curated taxons for displaying books. Includes a `subject_triggers` list for automated classification.
- **BookCategory**: The join table linking Books and Categories.
  - **Constraint**: During automated enrichment (via Open Library or Google Books), books are generally limited to their top **5–10 categories** to maintain relevance and prevent database bloat.

## 2. Subject Trigger Matching

Categories are automatically assigned based on "Subject Triggers."

### How it Works
1. When a book is imported or enriched (including via the **Standard Repair** tool), it receives a list of "Subjects" (strings from external APIs).
2. The `Category` model's `subject_triggers` field (a comma-separated string) is checked against these subjects.
3. If a match is found based on these triggers, the book is linked to that `Category` in the `BookCategory` table.
4. If no specific category matches, books are typically assigned to the **"New Books"** default category.

> [!NOTE]
> The **Standard Repair** tool has been enhanced to also perform this category enrichment if a book currently has no category associations.

## 3. Performance & Caching

With 5+ million records, the system uses high-performance query patterns.

### Database Indexing
- **Composite Index**: `idx_book_category_composite` on `(CategoryId, BookId)` ensures that filtering by category is nearly instantaneous.
- **Driving Index Pattern**: Public listing queries use index hints (`USE INDEX (books_is_visible_created_at)`) to force MySQL to use the most efficient scan for paginated results.

### Caching Strategy
- **Homepage Cache**: A global `homepageCache` stores the results of the main page and category-specific listings.
- **Pre-warming**: The system pre-fetches and caches global book counts to avoid expensive `COUNT(*)` operations on every request.

## 4. Public Filtering Logic

The public site is protected by a "Quality Guard" to ensure only complete records are shown.

### Hidden vs. Visible
Books are automatically excluded from public listings (Homepage, Search, Categories) if they meet any of these criteria:
- **Author**: Is `NULL`, empty, or "Unknown".
- **Description**: Is `NULL`, empty, or "No description available.".
- **Visibility**: `isVisible` is set to `false`.

### Admin Access
The Admin area (`/admin/books`) remains **unfiltered**, allowing administrators to see incomplete books and "repair" them (adding authors, descriptions, or categories) before they become visible to the public.

---
*Created on: 2026-02-09 | Optimized for 5M+ Book Records*
