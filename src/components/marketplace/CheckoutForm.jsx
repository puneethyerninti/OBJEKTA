// src/components/marketplace/CheckoutForm.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Lock, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useMarketplaceStore } from "../../store/MarketplaceStore";

// ─── Stripe publishable key from env / window ─────────────
const STRIPE_PK =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_PUBLISHABLE_KEY) ||
  (typeof window !== "undefined" && window.__STRIPE_PK__) ||
  "";

const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null;

const formatINR = (p) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(p);

// ─── Inner form (used inside Elements provider) ───────────
function StripeCheckoutInner({ clientSecret, orderId }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { cart, confirmOrder } = useMarketplaceStore();
  const items = cart?.items || [];

  const [step, setStep] = useState("review"); // review | processing | success | error
  const [error, setError] = useState(null);
  const [orderResult, setOrderResult] = useState(null);

  const total = items.reduce((sum, item) => {
    const price = item.product?.price ?? item.priceAtAdd ?? 0;
    return sum + price * item.quantity;
  }, 0);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setStep("processing");
    setError(null);

    // Confirm payment using PaymentElement (supports Card, UPI, PhonePe, etc.)
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/marketplace/orders/${orderId}`,
      },
      redirect: "if_required", // only redirect for UPI/bank flows, stay on page for cards
    });

    if (stripeError) {
      setStep("error");
      setError(stripeError.message || "Payment failed");
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      const confirmRes = await confirmOrder(orderId);
      if (!confirmRes.ok) {
        console.warn("Backend confirm failed but Stripe succeeded:", confirmRes.error);
      }
      setOrderResult(confirmRes.order || { _id: orderId });
      setStep("success");
      return;
    }

    if (paymentIntent && paymentIntent.status === "requires_action") {
      // Wait for redirect-based payment (UPI etc.) — handled by Stripe
      setStep("error");
      setError("Please complete the payment in your UPI app.");
      return;
    }

    setStep("error");
    setError(`Unexpected payment status: ${paymentIntent?.status || "unknown"}`);
  };

  if (step === "success") {
    return (
      <div className="mp-checkout-success">
        <CheckCircle2 size={64} className="mp-success-icon" />
        <h2>Payment Successful!</h2>
        <p>Your payment has been processed and your order is confirmed.</p>
        {orderResult && (
          <p className="mp-order-id">
            Order ID: <code>{orderResult._id}</code>
          </p>
        )}
        <div className="mp-checkout-actions">
          <button
            className="mp-btn mp-btn-primary"
            onClick={() => navigate(`/marketplace/orders/${orderResult?._id || ""}`)}
          >
            View Order & Downloads
          </button>
          <button
            className="mp-btn mp-btn-ghost"
            onClick={() => navigate("/marketplace")}
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mp-checkout-form">
      <div className="mp-checkout-header">
        <Lock size={18} />
        <h2>Secure Checkout</h2>
      </div>

      {/* Order Summary */}
      <div className="mp-checkout-summary">
        <h3>Order Summary</h3>
        {items.map((item, idx) => {
          const p = item.product || {};
          return (
            <div key={item._id || idx} className="mp-checkout-item">
              <span className="mp-checkout-item-name">
                {p.title || "Product"} × {item.quantity}
              </span>
              <span className="mp-checkout-item-price">
                {formatINR((p.price ?? item.priceAtAdd) * item.quantity)}
              </span>
            </div>
          );
        })}
        <div className="mp-checkout-divider" />
        <div className="mp-checkout-total">
          <span>Total</span>
          <span className="mp-checkout-total-price">{formatINR(total)}</span>
        </div>
      </div>

      {/* Stripe PaymentElement — shows Card, UPI/PhonePe, and other methods */}
      <div className="mp-checkout-payment">
        <h3>
          <CreditCard size={18} /> Choose Payment Method
        </h3>
        <div className="mp-stripe-card-wrapper">
          <PaymentElement
            options={{
              layout: "tabs",
              defaultValues: { billingDetails: { address: { country: "IN" } } },
            }}
          />
        </div>
        <p style={{ fontSize: "0.75rem", color: "#555", marginTop: 8 }}>
          Pay with UPI (PhonePe, GPay), Cards, or other methods. Secured by Stripe.
        </p>
      </div>

      {error && (
        <div className="mp-checkout-error" role="alert">
          <AlertTriangle size={14} style={{ marginRight: 6 }} />
          {error}
        </div>
      )}

      <button
        className="mp-btn mp-btn-primary mp-btn-full mp-btn-lg"
        onClick={handlePay}
        disabled={step === "processing" || items.length === 0 || !stripe}
      >
        {step === "processing" ? (
          <>
            <Loader2 size={18} className="mp-spin" /> Processing Payment…
          </>
        ) : (
          <>
            <Lock size={16} /> Pay {formatINR(total)}
          </>
        )}
      </button>
    </div>
  );
}

// ─── Wrapper that creates order → gets clientSecret → renders Stripe Elements ──
export default function CheckoutForm() {
  const navigate = useNavigate();
  const { cart, createOrder } = useMarketplaceStore();
  const items = cart?.items || [];

  const [clientSecret, setClientSecret] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [paymentProvider, setPaymentProvider] = useState(null);
  const [initError, setInitError] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const total = items.reduce((sum, item) => {
    const price = item.product?.price ?? item.priceAtAdd ?? 0;
    return sum + price * item.quantity;
  }, 0);

  // On mount, create the order to get a clientSecret
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (items.length === 0) {
        setInitializing(false);
        return;
      }

      const res = await createOrder("stripe");
      if (cancelled) return;

      if (!res.ok) {
        setInitError(res.error || "Failed to initialize checkout");
        setInitializing(false);
        return;
      }

      setClientSecret(res.clientSecret);
      setOrderId(res.order._id);
      setPaymentProvider(res.paymentProvider || "mock");
      setInitializing(false);
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (items.length === 0 && !orderId) {
    return (
      <div className="mp-empty">
        <h2>Your cart is empty</h2>
        <button className="mp-btn mp-btn-primary" onClick={() => navigate("/marketplace")}>
          Browse Marketplace
        </button>
      </div>
    );
  }

  if (initializing) {
    return (
      <div className="mp-loading">
        <div className="mp-spinner" />
        <p>Initializing secure checkout…</p>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="mp-checkout-form">
        <div className="mp-checkout-error" role="alert">
          <AlertTriangle size={16} style={{ marginRight: 6 }} />
          {initError}
        </div>
        <button className="mp-btn mp-btn-ghost" onClick={() => navigate("/marketplace/cart")}>
          Back to Cart
        </button>
      </div>
    );
  }

  // If Stripe is available and we have a clientSecret, wrap in Elements
  if (stripePromise && clientSecret && paymentProvider === "stripe") {
    return (
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: "night",
            variables: {
              fontFamily: "'Inter', system-ui, sans-serif",
              colorPrimary: "#7f5af0",
              colorBackground: "#0d0d14",
              colorText: "#e0e6ff",
              colorDanger: "#ff5555",
              borderRadius: "8px",
            },
          },
        }}
      >
        <StripeCheckoutInner
          clientSecret={clientSecret}
          orderId={orderId}
        />
      </Elements>
    );
  }

  // Mock fallback (no Stripe configured)
  return (
    <MockCheckoutInner
      orderId={orderId}
      paymentProvider={paymentProvider || "mock"}
    />
  );
}

// ─── Mock-mode inner form (no Stripe hooks) ──────────────────
function MockCheckoutInner({ orderId, paymentProvider }) {
  const navigate = useNavigate();
  const { cart, confirmOrder } = useMarketplaceStore();
  const items = cart?.items || [];
  const [step, setStep] = useState("review");
  const [error, setError] = useState(null);
  const [orderResult, setOrderResult] = useState(null);

  const total = items.reduce((sum, item) => {
    const price = item.product?.price ?? item.priceAtAdd ?? 0;
    return sum + price * item.quantity;
  }, 0);

  const handlePay = async () => {
    setStep("processing");
    const confirmRes = await confirmOrder(orderId);
    if (!confirmRes.ok) {
      setStep("error");
      setError(confirmRes.error || "Payment failed");
      return;
    }
    setOrderResult(confirmRes.order);
    setStep("success");
  };

  if (step === "success") {
    return (
      <div className="mp-checkout-success">
        <CheckCircle2 size={64} className="mp-success-icon" />
        <h2>Payment Successful!</h2>
        <p>Your order is confirmed.</p>
        <div className="mp-checkout-actions">
          <button className="mp-btn mp-btn-primary" onClick={() => navigate(`/marketplace/orders/${orderResult?._id || ""}`)}>View Order</button>
          <button className="mp-btn mp-btn-ghost" onClick={() => navigate("/marketplace")}>Continue Shopping</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mp-checkout-form">
      <div className="mp-checkout-header">
        <Lock size={18} />
        <h2>Secure Checkout</h2>
      </div>
      <div className="mp-checkout-summary">
        <h3>Order Summary</h3>
        {items.map((item, idx) => {
          const p = item.product || {};
          return (
            <div key={item._id || idx} className="mp-checkout-item">
              <span className="mp-checkout-item-name">{p.title || "Product"} × {item.quantity}</span>
              <span className="mp-checkout-item-price">{formatINR((p.price ?? item.priceAtAdd) * item.quantity)}</span>
            </div>
          );
        })}
        <div className="mp-checkout-divider" />
        <div className="mp-checkout-total">
          <span>Total</span>
          <span className="mp-checkout-total-price">{formatINR(total)}</span>
        </div>
      </div>
      <div className="mp-mock-payment-notice">
        <span className="mp-mock-badge">DEV MODE</span>
        <p>Stripe is not configured. Using mock payments.<br />Set <code>VITE_STRIPE_PUBLISHABLE_KEY</code> and <code>STRIPE_SECRET_KEY</code> in .env for real payments.</p>
      </div>
      {error && (
        <div className="mp-checkout-error" role="alert">
          <AlertTriangle size={14} style={{ marginRight: 6 }} />
          {error}
        </div>
      )}
      <button
        className="mp-btn mp-btn-primary mp-btn-full mp-btn-lg"
        onClick={handlePay}
        disabled={step === "processing" || items.length === 0}
      >
        {step === "processing" ? (
          <><Loader2 size={18} className="mp-spin" /> Processing…</>
        ) : (
          <><Lock size={16} /> Pay {formatINR(total)}</>
        )}
      </button>
    </div>
  );
}
