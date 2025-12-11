# Category Refactor & UI Polish

## Goal
1.  **Normalize Categories**: Move from string-based `category` in `Books` to a `Categories` table with UUIDs.
2.  **UI Improvements**: Use a dropdown (combo) for category selection in Admin.
3.  **Styling**: Fix Dark Mode for dropdown menus.

## Proposed Changes

### Database & Models
#### [NEW] [Category.js](file:///c:/development/Bookstore/models/Category.js)
-   `id`: UUID
-   `name`: String (Unique)

#### [MODIFY] [Book.js](file:///c:/development/Bookstore/models/Book.js)
-   Add `categoryId` FK.

#### [MODIFY] [index.js](file:///c:/development/Bookstore/models/index.js)
-   `Book` belongsTo `Category`.
-   `Category` hasMany `Book`.

#### [NEW] [migrate_categories.js](file:///c:/development/Bookstore/migrate_categories.js)
-   Script to:
    1.  Create `Categories` table.
    2.  Read all distinct categories from `Books`.
    3.  Insert them into `Categories`.
    4.  Add `categoryId` to `Books`.
    5.  Map existing books to new Category IDs.

### Backend Routes
#### [MODIFY] [admin.js](file:///c:/development/Bookstore/routes/admin.js)
-   `GET /books`: Fetch all `Categories` to pass to the view.
-   `POST /books/:id/update`: Accept `categoryId` instead of category name.

### Frontend Views
#### [MODIFY] [books.ejs](file:///c:/development/Bookstore/views/admin/books.ejs)
-   Replace Category text input with `<select>` populated by `categories`.
-   Show Category name from association (e.g., `book.Category.name`).

#### [MODIFY] [styles.css](file:///c:/development/Bookstore/public/css/styles.css)
-   Add `.dropdown-menu` dark mode styles.

## Verification
1.  Run migration.
2.  Check Admin > Books:
    -   Verify Edit Popup allows selecting from existing categories.
    -   Verify Popup is dark in dark mode.
    -   Change a book's category and save.
3.  Check public site filter (if affected, though primarily focused on Admin for this specific request).
