// Server Modules
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import logger from './logger.js';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
dotenv.config();

// Server Variables
const app = express();
app.use(cors());
app.use(express.json());

// Server Constants
const PORT = process.env.PORT;
const PAYPAL_CLIENT_ID = process.env.CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.CLIENT_SECRET;
const PAYPAL_SELLER_ID = process.env.SELLER_ID;
// const PAYPAL_SANDBOX_ENDPOINT = 'https://api-m.sandbox.paypal.com';

// Simple Map to hold refund requests
const processedTransactions = new Map();

// Server Auth Functions => Access tokens and AuthAssertion for refund
const generateAccessToken = async () => {
    try {
        const auth = `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`;
        const bodyData = 'grant_type=client_credentials';
        const res = await fetch(`${process.env.URL}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(auth).toString('base64')
            },
            body: bodyData
        });
        
        const data = await res.json();

        // scope
        // access_token
        // token_type
        // app_id
        // expires_in
        // nonce

        return data.access_token;
    } catch (error) {
        logger.error("Failed to generate Access Token:", error);
    }  
};

// function to encode the header and payload for the AuthAssertion as per docs
function base64url(json) {
    return Buffer.from(JSON.stringify(json)).toString('base64')
        .replace(/=+$/, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

// function to generate the AuthAssertion for the refund as per docs
const getAuthAssertionValue = async (clientId, sellerPayerId) => {

	const header = {
		"alg": "none"
	};

	const encodedHeader = base64url(header);
	const payload = {
		"iss": clientId,
		"payer_id": sellerPayerId
	};
	const encodedPayload = base64url(payload);
	return `${encodedHeader}.${encodedPayload}.`;
}

// simple cookie cutter uuid generator for PayPal-Request-Id required for refund
function generatePayPalRequestId(transactionId) {
  if (processedTransactions.has(transactionId)) {
    throw new Error(`Refund already processed for Transaction ID: ${transactionId}`);
  }
  const PayPalRequestId = uuidv4();
  logger.info(`Generated Request ID: ${PayPalRequestId} for Transaction ID: ${transactionId}`);
  processedTransactions.set(transactionId, PayPalRequestId);
  return PayPalRequestId;
}

const testConnection = async () => {
    const accessToken = await generateAccessToken();
    console.log(accessToken);
}

// Agnostic Response Handler
// This function will handle the response from the PayPal API and return the JSON response and HTTP status code.
const handleResponse = async (response) => {
    try {
      const jsonResponse = await response.json();
      return {
        jsonResponse,
        httpStatusCode: response.status,
      };
    } catch (err) {
      const errorMessage = await response.text();
      throw new Error(errorMessage);
    }
}

// Create Order Function
const createOrder = async (cart) => {
    logger.info(
      "shopping cart information passed from the frontend createOrder() callback:",
      cart,
    );
    const accessToken = await generateAccessToken();
    const url = `${process.env.URL}/v2/checkout/orders`;

    const purchaseUnits = Object.values(cart).map(product => ({
      amount: {
        currency_code: "EUR",
        // divide by 100 to convert cents to euros
        value: (product.price/100).toFixed(2),
      },
    }));

    const payload = {
      intent: "CAPTURE",
      purchase_units: purchaseUnits,
    };
    
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
        // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
        // "PayPal-Mock-Response": '{"mock_application_codes": "MISSING_REQUIRED_PARAMETER"}'
        // "PayPal-Mock-Response": '{"mock_application_codes": "PERMISSION_DENIED"}'
        // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
      },
      method: "POST",
      body: JSON.stringify(payload),
    });
    
    return handleResponse(response);
};

const captureOrder = async (orderID) => {
    const accessToken = await generateAccessToken();
    const url = `${process.env.URL}/v2/checkout/orders/${orderID}/capture`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
        // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
        // "PayPal-Mock-Response": '{"mock_application_codes": "INSTRUMENT_DECLINED"}'
        // "PayPal-Mock-Response": '{"mock_application_codes": "TRANSACTION_REFUSED"}'
        // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
      },
    });
    return handleResponse(response);
};

const createRefundRequest = async (orderID) => {  
  const clientID = PAYPAL_CLIENT_ID; 
  const sellerPayerID = PAYPAL_SELLER_ID; 
  console.log('clientID -> ', clientID);
  console.log('sellerPayerID -> ', sellerPayerID);
  const jwt = await getAuthAssertionValue(clientID, sellerPayerID); 
  console.log('jwt -> ', jwt);
  const accessToken = await generateAccessToken();
  const url = `${process.env.URL}/v2/payments/captures/${orderID}/refund`;
  // 123e4567-e89b-12d3-a456-426655440020 in this format
  const paypalRequestId = generatePayPalRequestId(orderID); 
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "PayPal-Auth-Assertion": jwt,
      "PayPal-Request-Id": paypalRequestId,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({}) 
  });

  return handleResponse(response);
}

app.post("/api/orders", async (req, res) => {
    try {
      // use the cart information passed from the front-end to calculate the order amount detals
      const { cart } = req.body;
      const { jsonResponse, httpStatusCode } = await createOrder(cart);
      res.status(httpStatusCode).json(jsonResponse);
      logger.info(`Order created successfully with status code: ${httpStatusCode} - ${JSON.stringify(jsonResponse)}`);
    } catch (error) {
      logger.error("Failed to create order:", error);
      res.status(500).json({ error: "Failed to create order." });
    }
});
    
app.post("/api/orders/:orderID/capture", async (req, res) => {
    try {
      const { orderID } = req.params;
      const { jsonResponse, httpStatusCode } = await captureOrder(orderID);
      res.status(httpStatusCode).json(jsonResponse);
      logger.info(`Order captured successfully with status code: ${httpStatusCode} - ${JSON.stringify(jsonResponse)}`);
    } catch (error) {
      logger.error("Failed to create order:", error);
      res.status(500).json({ error: "Failed to capture order." });
    }
});

app.post("/api/orders/:orderID/refund", async (req, res) => {
  try {
    const { orderID } = req.params;
    const { jsonResponse, httpStatusCode } = await createRefundRequest(orderID);
    res.status(httpStatusCode).json(jsonResponse);
    logger.info(`Order refunded attempted with status code: ${httpStatusCode} - ${JSON.stringify(jsonResponse)}`);
  } catch (error) {
    logger.error("Failed to process refund order:", error);
    res.status(500).json({ error: "Failed to refund order." });
  }
});

app.listen(PORT, () => {
    logger.info(`Paypal Server: http://localhost:${PORT}`);
});