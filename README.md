# PayPal Checkout Integration Setup

This repo demonstrations the integratation of the standard PayPal Checkout, allowing for order processing and refunds. It uses Node.js for the backend and React for the frontend.

## Prerequisites

- Node.js
- npm

## Configuration

### Backend Environment Variables

In the root of node-backend, create a `.env` file with the following:

```env
PORT=8000
URL=https://api-m.sandbox.paypal.com
CLIENT_ID=<Your_PayPal_Client_ID>
CLIENT_SECRET=<Your_PayPal_Client_Secret>
SELLER_ID=<Your_Seller_ID> || <email address value for your dummy merchant account>
```

In root of your react-frontend, create another `.env` file with your Client ID style as follows:
```env
VITE_PAYPAL_CLIENT_ID=<Your_PayPal_Client_ID>
```

## Running the Project
Open two terminal windows, one for each component of our application. In the node-backend directory, run the following:
```
npm install
node server
```

In the react-frontend directory, run the following:
```
npm install
npm run dev
```
