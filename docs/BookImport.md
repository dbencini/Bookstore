# Book Import System

The bookstore uses an optimized, background-based import system designed to handle millions of records efficiently.

## Core Features

- **Batch Processing**: Rows are processed in configurable batches (default: 500) rather than one-by-one.
- **Database Transactions**: Each batch is wrapped in a single database transaction, significantly improving write speeds on SQLite.
- **Pre-Import Row Counting**: The system scans the import file (CSV or extracted from ZIP) before starting to provide accurate "Total Rows Detected" feedback.
- **Duplicate Handling**: Matches existing books by ISBN or Title/Author. New records are "Added," while existing ones are "Updated" (e.g., applying markups).
- **Multipart Support**:
  - **Direct CSV/ZIP Upload**: Upload via the Admin UI.
  - **Manual Library ZIP**: Detects a `library.zip` file in the `uploads/` directory for high-speed local processing.

## Technical Implementation

- **Service**: `services/bookService.js` -> `importBooksFromCSV`
- **Background Tracking**: Uses the `Job` model to track state, progress, and success/failure metrics.
- **UI**: `views/admin/import.ejs` polls `/admin/jobs/:id/status` via AJAX.
