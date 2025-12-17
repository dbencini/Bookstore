# CloudPrinter Integration - Outstanding Tasks

## Critical
- [ ] **API Keys**: configure `CLOUDPRINTER_API_KEY` in `.env`.
- [ ] **Webhook Receiver**: Implement `POST /webhooks/cloudprinter` to actually receive the JSON payload from CloudPrinter and call `CpOrder.create(...)`. Currently, we only have the database models readiness.
- [ ] **Signal Sender**: Implement a service to send `ItemShipped` signals back to CloudPrinter when the "Dispatch" box is ticked in the Workshop.
- [ ] **S3 Download**: The current `download-file` implementation creates a dummy file. You need to implement the actual Axios stream download from the `file.url` provided by CloudPrinter.

## Enhancements
- [ ] **Auto-Download**: Automatically download files upon order receipt (via Webhook) instead of manual button press.
- [ ] **Error Handling**: Better error handling for failed downloads or S3 permissions.
- [ ] **Security**: Validate the "CloudPrinter Production Header" hash in the webhook to ensure authenticity.

## Sandbox & Testing
- **Sandbox Environment**: CloudPrinter offers a sandbox for risk-free testing. Orders appear in the dashboard but do not print.
- **Resources**:
    - [CloudPrinter Order API JSON v2.1](https://docs.cloudprinter.com/production/cloudprinter-order-api-json-v2-1)
    - [CloudSignal Webhooks v2.0](https://docs.cloudprinter.com/client/cloudsignal-webhooks-v2-0)
- [ ] **Setup Sandbox**: Register a free account and configure the "CloudCore API Interface" in Sandbox mode.
- [ ] **Test Order**: Use Postman or cURL to send a test JSON payload to your webhook endpoint to simulate an order.
