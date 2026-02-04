# Data Repair & Background Maintenance

The Data Repair system is a sophisticated background engine designed to enrich your library data with minimal impact on API quotas and server performance.

## Key Strategies

- **Popularity Prioritization**: The repair engine sorts books by `stock` levels (descending), ensuring your most important/available products are fixed first.
- **High-Accuracy Matching**: Focuses strictly on books with **ISBNs** to avoid fuzzy matches and maximize API lookup success.
- **"Stealth" Throttling**: 
  - **Item Delay**: 3-second pause between individual API calls.
  - **Batch Delay**: 30-second pause after every batch of 25 items.
  - **429 Handling**: Automatic 60-second "heavy wait" if Google Books API rate limits are encountered.
- **Persistent State**: The job saves the current position to the database. If the server reboots, the job can be **Resumed** from the exact point it paused.

## Controls

- **Pause/Resume**: Users can manually pause a job to free up system resources or API quota and resume later.
- **Stop**: Gracefully terminates the repair process.
- **Global Status Board**: A central UI component at the top of the Admin Import page monitors the background state in real-time.

## Technical Implementation

- **Service**: `services/bookService.js` -> `processDataRepairBackground`
- **API**: Uses `axiosWithRetry` for resilient Google Books API communication.
- **Model**: Progress is persisted in the `Jobs` table (`lastProcessedId`, `fixedCount`, etc.).
