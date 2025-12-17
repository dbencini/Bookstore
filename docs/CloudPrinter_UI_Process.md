# CloudPrinter UI Process

## Overview

The CloudPrinter integration is built into the existing **Workshop Tasks** page (`/admin/workshop`). This allows production staff to manage both local website orders and external CloudPrinter orders in a single unified view.

## Integration Features

### 1. Unified Workshop Grid
- **Source Indicator**: A new column "Source" shows whether an order is from the "Website" or "Cloud Print".
- **Order ID**: Displays the relevant order ID (Website Order ID or CloudPrinter Order ID).
- **Files / Actions**:
    - For CloudPrinter orders, this column displays the available files (e.g., `cover`, `book`).
    - **Hotfolder Download**: Clicking the "Hotfolder" button triggers the server to download the file to the configured hotfolder (e.g., `public/hotfolder`). This simulates appropriate integration with local print hardware.
    - **Status Tracking**: Once downloaded, the badge changes to "Downloaded".
    - **Clean Up**: A delete (trash) icon allows removing the file from the hotfolder after production is complete.

### 2. Status Updates
- The existing "3-Knife Trim" and "Dispatch" checkboxes function for CloudPrinter orders just as they do for website orders.
- Ticking these updates the local status. (Future Scope: Ticking "Dispatch" could trigger a `CpSignal` to be sent back to CloudPrinter to update the global status).

## Workflow

1. **Monitor**: Refresh the Workshop page to see new incoming orders.
2. **Download**: For a new CloudPrint order, click "Hotfolder" next to the book/cover files.
3. **Print**: The file appears in `public/hotfolder` (mapped to your printer).
4. **Finish**: After binding/trimming, tick "3-Knife Trim".
5. **Ship**: Tick "Dispatch".
6. **Cleanup**: Click the trash icon to remove the file from the hotfolder to save space.
