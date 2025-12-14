# PayFast Testing Manual

## Testing Environment
This project is configured to use the **PayFast Sandbox**. You do not need a real credit card or a registered account to test.

## How to Test Checkout

1.  **Add Items**: Go to the bookstore and add items to your cart.
2.  **Checkout**: Click the "Checkout" button in the cart.
3.  **Redirect**: You will be redirected to the PayFast Sandbox page.
    - You should see "Test Merchant" and your Order ID (e.g., `Order #7D1C2B5F`).
4.  **Complete Payment**: Click "Complete Payment".
    - No card details are needed for the generic test merchant.
5.  **Success**: You will be redirected back to the bookstore's success page.
    - **Note**: The cart will automatically clear upon your return.

## Verifying Backend Order Completion (Localhost Only)

Because your computer (`localhost`) is not on the public internet, PayFast cannot send the official "Payment Complete" signal (ITN) to your database.

**To verify the backend logic actually works:**

1.  **Complete a Checkout** as described above.
2.  **Find your Order ID**:
    - Run the helper script: 
      ```bash
      node find_latest_order.js
      ```
    - Copy the ID (e.g., `a06f1920-...`).
3.  **Simulate the ITN**:
    - Run the simulation script:
      ```bash
      node simulate_itn.js <ORDER_ID> <AMOUNT>
      ```
      *Example:* `node simulate_itn.js a06f1920-2eec 19.99`
4.  **Check Database**: The order status should now be `completed`.

## Troubleshooting

- **Signature Mismatch**: Ensure you are using the `_paynow` configuration (no signature generation). The current code handles this automatically.
- **Cart Not Clearing**: The success page forces a clear on localhost. If simulating ITN, ensure the Order ID matches exactly.
