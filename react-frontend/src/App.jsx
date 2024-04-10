// NOTE SELLER_ID == ACCOUNT_ID in the PayPal Sandbox environment online

import { useEffect, useState } from "react";
import { PayPalButtons, usePayPalScriptReducer } from "@paypal/react-paypal-js";

const style = {"layout":"vertical"};

const product = {
  name: "Nike Air Max SC",
  description: "Product Description",
  id: 1,
  // price in cents
  price: "10000",
  currency: "EUR",
  image: "https://static.nike.com/a/images/t_PDP_1728_v1/f_auto,q_auto:eco/bd6363ee-7091-4f81-b673-fd0bc7e31272/air-max-sc-shoes-V8dbFX.png",
}

export default function App() { 

  // Captured ID state
  const [transactionID, setTransactionID] = useState(null);

  // Modal visibility states and related states
  const [showModal, setShowModal] = useState(false);
  const [transcationProcessed, setTransactionProcessed] = useState(false);
  const [transactionSuccess, setTransactionSuccess] = useState(false);

  // Refund ternaries for refund status and messaging
  const [refundStatus, setRefundStatus] = useState(null);

  const createOrder = async () => {

    try {
      const response = await fetch("http://localhost:8000/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // use the "body" param to optionally pass additional order information
        // like product ids and quantities
        body: JSON.stringify({
          cart: [
            {
              id: product.id,
              price: product.price,
              quantity: 1
            },
          ],
        }),
      });
      
      const orderData = await response.json();
        
      if (orderData.id) {
        return orderData.id;
      } else {
        const errorDetail = orderData?.details?.[0];
        const errorMessage = errorDetail
          ? `${errorDetail.issue} ${errorDetail.description} (${orderData.debug_id})`
          : JSON.stringify(orderData);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error(error);
    }
  };
  
  const onApprove = async (data, actions) => {
    try {
      const response = await fetch(`http://localhost:8000/api/orders/${data.orderID}/capture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        }
      ,});
      
      const orderData = await response.json();
      // Three cases to handle:
      //   (1) Recoverable INSTRUMENT_DECLINED -> call actions.restart()
      //   (2) Other non-recoverable errors -> Show a failure message
      //   (3) Successful transaction -> Show confirmation or thank you message
      
      const errorDetail = orderData?.details?.[0];
        
      if (errorDetail?.issue === "INSTRUMENT_DECLINED") {
        // (1) Recoverable INSTRUMENT_DECLINED -> call actions.restart()
        // recoverable state, per https://developer.paypal.com/docs/checkout/standard/customize/handle-funding-failures/
        return actions.restart();
      } else if (errorDetail) {
        // (2) Other non-recoverable errors -> Show a failure message
        setShowModal(true);
        setTransactionSuccess(false);
        setTransactionProcessed(true);
        throw new Error(`${errorDetail.description} (${orderData.debug_id})`);
      } else if (!orderData.purchase_units) {
        throw new Error(JSON.stringify(orderData));
      } else {
        // (3) Successful transaction -> Show confirmation or thank you message
        // Or go to another URL:  actions.redirect('thank_you.html');
        console.log(
          "Capture result",
          orderData,
          JSON.stringify(orderData, null, 2),
        );
        setTransactionProcessed(true);
        setTransactionID(orderData.purchase_units[0].payments.captures[0].id);
        setShowModal(true);
        setTransactionSuccess(true);
      }
    } catch (error) {
      setShowModal(true);
      setTransactionSuccess(false);
      setTransactionProcessed(true);      
      console.error(error);
    }
  }

  const initiateRefund = async (captureID) => {
    
    // console.log("Refunding order", captureID);

    setRefundStatus('pending');

    try {

      const response = await fetch(`http://localhost:8000/api/orders/${captureID}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({captureID}),
      });

      const refundRequest = await response.json();

      console.log("Refund request", refundRequest);

      if (refundRequest.status === 'COMPLETED'){
        setRefundStatus('complete');
      } else {
        setRefundStatus('error');
      }
    } catch (error) {
      console.error(error);
      setRefundStatus('error');
    }
  }

  // Functional component to render the PayPal buttons 
  // Could be handled in own component file
  const ButtonWrapper = ({ showSpinner }) => {

    const [{ isPending }] = usePayPalScriptReducer();

    return (
      <>
        { (showSpinner && isPending) && <div className="spinner" /> }
        <PayPalButtons
          style={style}
          disabled={false}
          forceReRender={[style]}
          fundingSource={undefined}
          createOrder={createOrder}
          onApprove={onApprove}
          className="custom-paypal-buttons"
        />
      </>
    );
  }
  
  return (
      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        minHeight: '100vh',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 0 8px rgba(0,0,0,0.1)',
          backgroundColor: '#fff',
          maxWidth: '600px'
        }}>
          <h1>{product.name}</h1>
          <img 
            src={product.image}
            alt={product.name}
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '480px',
              borderRadius: '12px',
              objectFit: 'cover',

            }}
          />
          <h2>Price: €{(product.price/100).toFixed(2)}</h2>
          <ButtonWrapper showSpinner={false} />
        </div>
        {showModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center', 

          }}>
            <div style={{
              backgroundColor: '#fff',
              padding: '1rem',
              borderRadius: '8px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              maxWidth: '400px',
            }}>
              {transcationProcessed && transactionSuccess ? <h2 style={{margin: '0', marginTop: '1rem'}}>Transaction Successful</h2>: <h2 style={{margin: '0', marginTop: '1rem'}}>Transaction Failure</h2>}
              {transcationProcessed && transactionSuccess ? <p>Your transaction ID is <span style={{color: '#0070f3'}}>{transactionID}</span></p>: <p>There was an error processing your transaction. Please check your email.</p>}
              {refundStatus === 'pending' ? <p style={{margin: '0'}}>Refund is processing for transaction ID <span style={{color: '#0070f3'}}>{transactionID}</span></p> : null}
              {refundStatus === 'complete' ? <p style={{margin: '0'}}>Refund request has been processed for transaction ID <span style={{color: '#0070f3'}}>{transactionID}.</span> Please check your email</p> : null}
              {refundStatus === 'error' ? <p >There was an issue processing our refund. Please check your email</p> : null}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '1rem',
              }}
              >
                {transactionID ? 
                  <button style={{
                    padding: '12px 24px',
                    borderRadius: '5px',
                    border: 'none',
                    backgroundColor: '#0070f3',
                    color: '#fff',
                    cursor: 'pointer',
                    marginLeft: '1rem',
                  }} onClick={() => initiateRefund(transactionID)}>Refund</button>
                : null}
                <button style={{
                  padding: '12px 24px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: '#bdc3c7',
                  color: '#fff',
                  cursor: 'pointer',
                }} onClick={() => setShowModal(false)}>Close</button>

              </div>
            </div>
          </div>
        )}
      </div>
  );
}
