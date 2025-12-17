1. Courier
2. Address
3. LSI...B1
	Order LSI Title and POD (internal) titles have "Print Files"
	Request LSI file which is print file speak to Ettien
	
POD Retailer ie IndieBooks

IndieBooks Server: "Hello LSI. Create Order #998877." LSI Server: "Okay. What are we printing?" IndieBooks Server: "We need 1 copy of SKU: 978-3-16-148410-0." LSI Server: "Shipping where?" IndieBooks Server: "Jane Doe, 123 Main St, London."

{
  "order_id": "10055",
  "recipient": {
    "name": "Jane Doe",
    "address": "123 Main St..."
  },
  "items": [
    {
      "sku": "978-3-16-148410-0",  <-- THIS tells them which Print File to use
      "quantity": 1
    }
  ]
}


1. The "Closed Castle" Model: Ingram Global Connect
Ingram Content Group (ICG) does not have a public "Sign Up" API for printers. You cannot simply get an API key and start coding.

The Program: You are applying for Ingram Global Connect (specifically the Print Partner tier).

The API: They use a system often tied to CoreSource Plus.

How to get the Docs: You must sign a contract first.

Contact Ingram Content Group - International Sales.

Sign the NDA and MSA (Master Service Agreement).

Their integration team sends you the Global Connect Integration Guide (usually a PDF with SOAP/XML or REST definitions).

How the Software Logic Works (Ingram Model)
Ingram is obsessed with security. They will not "push" the file to you. You must "fetch" it using a secure token.

The Trigger: Ingram sends your server a small XML/JSON ticket (via SFTP or API Push) saying "Order #123 is ready."

The Handshake: Your server requests a One-Time Access Token for that specific ISBN.

The Fetch: You download the PDF. Note: The URL often expires in 60 minutes.

The "Shred": Your software must explicitly delete the file to stay compliant with their audit.

---------------------------------------------

2. The "Open Market" Model: CloudPrinter
This is the easier route for a developer. CloudPrinter was built specifically to connect independent print shops (like your retailer) to global orders via a modern API.

The Program: CloudPrinter Print Partner.

The API: Publicly documented and modern (JSON/REST).

Where to get the Docs: docs.cloudprinter.com (Look for the "Production Interface" section).

How the Software Logic Works (CloudPrinter Model)
CloudPrinter works on a "Signal" basis.

Configuration: In their dashboard, you set a "Production Endpoint" (e.g., https://api.your-retailer.com/webhook/orders).

The Payload: When an order comes, they POST a JSON payload to your server containing the direct URLs for the Cover and Interior.

The Signal: As your machine prints, binds, and ships, your software sends "Signals" back (e.g., status: "printed", status: "shipped").


