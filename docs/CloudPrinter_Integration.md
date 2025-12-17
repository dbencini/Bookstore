# CloudPrinter Integration

## Overview
This document details the integration of CloudPrinter functionality into the Bookstore application. The integration assumes the "Production Partner" model, where the Bookstore acts as a print provider receiving orders from CloudPrinter.

## Database Schema
We have established the following tables, all prefixed with `cp_` to distinguish them from the core Bookstore tables.

### 1. `cp_orders`
Stores incoming orders from CloudPrinter.
- **cpOrderId**: The unique ID provided by CloudPrinter.
- **clientReference**: Reference ID from the client.
- **status**: Local processing status (e.g., 'received', 'in_production', 'shipped').
- **fullJsonPayload**: A complete dump of the original JSON for audit/debugging purposes.

### 2. `cp_order_items`
Stores individual items (books) within an order.
- **cpItemId**: unique CloudPrinter Item ID.
- **productCode**: The product type (e.g., 'hardcover_a4').
- **quantity**: Number of copies.
- **status**: Item-level status.

### 3. `cp_addresses`
Stores delivery and billing addresses associated with an order.
- Normalized structure with fields for `company`, `name`, `street1`, `zip`, `city`, etc.

### 4. `cp_files`
Stores file references for orders and items.
- **type**: 'cover', 'book', 'shipping_label'.
- **url**: The S3 (or other) URL to download the file.
- **localPath**: Path to the downloaded file on the local server.

### 5. `cp_signals`
An audit log of all signals (webhooks) sent back to CloudPrinter to update order status.
- **signalType**: e.g., 'ItemProduce', 'ItemShipped'.
- **payload**: The JSON payload sent.
- **responseCode**: The HTTP status code received from CloudPrinter.

## Integration Flow

### Receiving Orders
1. CloudPrinter sends a POST request to your endpoint (e.g., `/webhooks/cloudprinter/order`).
2. The payload is parsed and validated.
3. A new record is created in `cp_orders`.
4. Related records are created in `cp_order_items`, `cp_addresses`, and `cp_files`.
5. Files (PDFs) should be queued for download.

### Sending Status Updates (Signals)
1. When a production step completes (e.g., file downloaded, printed, shipped), the system triggers a Signal.
2. A JSON payload is constructed according to the CloudSignal v2.0 spec.
3. The signal is sent to the CloudPrinter signal endpoint.
4. The attempt and result are logged in `cp_signals`.

## Next Steps
- Implement the Order Receipt Endpoint (Controller/Route).
- Implement the Signal Sender Service.
- Set up a queue for file downloading.
