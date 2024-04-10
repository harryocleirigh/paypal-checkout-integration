import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

import { PayPalScriptProvider } from "@paypal/react-paypal-js";


const initialOptions = {
  clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID,
  currency: "EUR",
  intent: "capture",
};


ReactDOM.createRoot(document.getElementById('root')).render(
  <PayPalScriptProvider options={initialOptions}>
    <App />
  </PayPalScriptProvider>,
)
