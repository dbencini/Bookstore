# Admin Grid & UI Reference

This document outlines the standard styling and functionality for Admin Dashboard grids (e.g., Book Management, User Management). Use this reference for all future admin screens to ensure consistency.

## 1. Visual Style (Dark Theme Compatible)

The application uses a **Dark Gray / White Ink** aesthetic for admin panels.

### Standard Classes
-   **Wrapper**: `.admin-panel-dark`
    -   **Background**: `#343a40` (Dark Gray)
    -   **Text**: `#f8f9fa` (White Ink)
    -   **Border**: `#454d55`

### Components
#### A. Advanced Search Card
Collapsible search panels must use the `.admin-panel-dark` class. The card body adapts to the user's theme while keeping the header dark.

**HTML Structure**:
```html
<div class="card mb-3 admin-panel-dark">
    <div class="card-header d-flex justify-content-between align-items-center">
        <span class="fw-bold">Advanced Search</span>
        <button class="btn btn-sm btn-outline-light" ...>Toggle Filters</button>
    </div>
    <div class="collapse show" id="searchPanel">
        <div class="card-body">
            <!-- Form Inputs -->
        </div>
    </div>
</div>
```

**Theme Logic (CSS)**:
-   **Header**: Always Dark Gray (`#343a40`).
-   **Body (Light Mode)**: Very Light Gray (`#f8f9fa`) with Dark Text (`#212529`).
-   **Body (Dark Mode)**: Lighter Dark Gray (`#454d55`) with Light Text (`#e0e0e0`).

#### B. Info Panels / Counters
Counters should be simple text placed **above** the Advanced Search card (no card container).
```html
<div class="mb-3 text-secondary">
    Total Books: <strong><%= totalBooks %></strong> (Page <%= currentPage %>)
</div>
```

#### C. Pagination
Pagination *must* be wrapped in `.admin-panel-dark` to trigger specific overrides that enforce the monochrome look.
```html
<div class="admin-panel-dark p-2 rounded mt-3">
    <nav>
        <ul class="pagination justify-content-center mb-0">
            <!-- Items -->
        </ul>
    </nav>
</div>
```
-   **Buttons**: Dark Gray (`#343a40`).
-   **Active**: Lighter Gray (`#495057`) - *No Blue*.
-   **Text**: White (`#f8f9fa`).

## 2. Server-Side Functionality

All grids must implement efficient server-side operations.

### Pagination
-   **Limit**: **12** rows per page (Standard).
-   **Handling**:
    ```javascript
    const { page = 1 } = req.query;
    const limit = 12;
    const offset = (page - 1) * limit;
    ```
-   **UI**: Generate First, Previous, Next, Last links. Preserve current search params in links.

### Search & Filtering
-   **Persistence**: Filter parameters (e.g., `?title=Harry`) must be passed back to the view and preserved in pagination links.
-   **Operators**:
    -   **Text**: `[Op.like]: '%value%'` (Case-insensitive via collation or `LOWER()`).
    -   **Dictionary (Categories)**: Filter by associated model name.
    -   **Dates**: `[Op.gte]` / `[Op.lte]` (Start/End range).

### View Implementation
-   **Comboboxes**: Use `<select>` populated by dictionary tables (e.g., Categories) with `[data-theme="dark"]` compatible styles (SVG arrow overrides).

### Interactive Behavior

#### A. Row Highlighting (Persistence)
-   **Behavior**: Clicking any table row adds a `.table-highlight` class.
-   **Persistence**: The ID of the last clicked row is saved to `localStorage`. On page load, the row is re-highlighted and automatically scrolled into view.
-   **CSS**:
    -   Light Mode: Light Blue (`#e2f0fd`)
    -   Dark Mode: Deep Blue (`#375a7f`) via `[data-theme="dark"]` selector.

#### B. Action Buttons (Toolbars)
-   **Small Actions** (e.g., Visibility Toggle "Eye Icon", Delete):
    -   **Must use AJAX** (`fetch`).
    -   **Backend**: Route return JSON `{ success: true }`.
    -   **Frontend**: Instantly update the DOM (toggle icon class / badge color) **without reloading the page**.

#### C. Main Edit Forms (Modals)
-   **Method**: Submit via `fetch` to catch server errors (e.g., validation, session expired).
-   **Completion**: On `success: true`, perform a **Full Page Reload** (`window.location.reload()`).
    -   *Rationale*: Ensures all related data (sums, sorting, counters) are 100% accurate without complex client-side state management.
