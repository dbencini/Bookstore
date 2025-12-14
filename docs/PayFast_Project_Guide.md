# PayFast Integration: Project Guide

## Overview
This project integrates PayFast using the **Simplified `_paynow` Integration** method. This approach allows users to check out via a simple HTML form submission without requiring server-side signature generation for the initial request.

## Configuration
The configuration is stored in `config/payfast.js` and `routes/cart.js`.

### Credentials
- **File**: `config/payfast.js`
- **Method**: The integration defaults to the PayFast Sandbox ID `10000100` (Universal Test Merchant).
- **Production**: To go live, replace `PAYFAST_MERCHANT_ID` with your actual Merchant ID in `config/payfast.js` (or move to `.env`).

## Architecture

### 1. Checkout Flow (`routes/cart.js`)
- **Route**: `POST /cart/checkout`
- **Logic**:
    1. Calculates cart total.
    2. Creates a `PENDING` Order in the database.
    3. Constructs a `_paynow` payload containing:
        - `cmd`: `_paynow`
        - `receiver`: Merchant ID
        - `item_name`: `Order #<ShortID>`
        - `amount`: Order Total
        - `m_payment_id`: Internal Order UUID (for tracking)
        - `return_url`: `/cart/checkout/success`
        - `cancel_url`: `/cart/checkout/cancel`
        - `notify_url`: `/cart/checkout/notify`
    4. Renders `views/payfast_redirect.ejs` which auto-submits the form to `https://sandbox.payfast.co.za/eng/process`.

### 2. Instant Transaction Notification (ITN)
- **Route**: `POST /cart/checkout/notify`
- **Purpose**: Server-to-Server confirmation from PayFast.
- **Logic**:
    1. Receives POST data from PayFast.
    2. Logs the receipt.
    3. Checks if `payment_status` is `COMPLETE`.
    4. **Updates Order Status**: Sets the order status to `completed` in the database.
    5. **Clears Cart**: Removes items associated with the user's cart.

### 3. Success Page
- **Route**: `GET /cart/checkout/success`
- **UX Enhancement**: Since `localhost` cannot receive the ITN callback (it's not publicly accessible), this route **forcefully clears the cart** to ensure a smooth user experience during testing.

## Files
- `config/payfast.js`: Configuration constants.
- `routes/cart.js`: Core logic for checkout, ITN, and success/cancel.
- `views/payfast_redirect.ejs`: Auto-submitting form.
- `simulate_itn.js`: Script to mimic ITN for local testing.
