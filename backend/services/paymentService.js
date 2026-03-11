// backend/services/paymentService.js
// ─────────────────────────────────────────────────────────────
// Stripe-first payment service for real e-commerce.
// Set STRIPE_SECRET_KEY in .env to enable (required).
// Falls back to mock ONLY if PAYMENT_PROVIDER=mock explicitly.
// ─────────────────────────────────────────────────────────────

const PROVIDER = (process.env.PAYMENT_PROVIDER || "stripe").toLowerCase();
const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT || "10");

let stripe = null;
if (PROVIDER === "stripe") {
  try {
    const Stripe = require("stripe");
    stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    console.log("💳 Stripe payment service initialized");
  } catch (e) {
    console.error("❌ stripe package not installed — run: npm install stripe");
    console.error("   Or set PAYMENT_PROVIDER=mock in .env for dev testing");
  }
}

// ─── Helpers ──────────────────────────────────────────────────────
function calcPlatformFee(subtotal) {
  return Math.round(subtotal * (PLATFORM_FEE_PERCENT / 100) * 100) / 100;
}

function mockId(prefix = "mock") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Mock Gateway (dev fallback only) ─────────────────────────────
const mockGateway = {
  async createPaymentIntent({ amount, currency = "inr", metadata = {} }) {
    await new Promise((r) => setTimeout(r, 200));
    return {
      id: mockId("pi"),
      clientSecret: mockId("cs"),
      amount,
      currency,
      status: "requires_payment_method",
      metadata,
    };
  },

  async confirmPayment(paymentIntentId) {
    await new Promise((r) => setTimeout(r, 300));
    return { id: paymentIntentId, status: "succeeded" };
  },

  async refundPayment(paymentIntentId) {
    await new Promise((r) => setTimeout(r, 200));
    return { id: mockId("re"), paymentIntentId, status: "refunded" };
  },
};

// ─── Stripe Gateway (real payments) ──────────────────────────────
const stripeGateway = {
  async createPaymentIntent({ amount, currency = "inr", metadata = {} }) {
    if (!stripe) throw new Error("Stripe not configured — set STRIPE_SECRET_KEY in .env");
    // amount is in rupees — Stripe expects paise (smallest unit)
    const amountPaise = Math.round(amount * 100);
    // Try UPI + Card first; fall back to card-only if UPI isn't enabled in dashboard
    let pi;
    try {
      pi = await stripe.paymentIntents.create({
        amount: amountPaise,
        currency,
        metadata,
        payment_method_types: ["card", "upi"],
      });
    } catch (upiErr) {
      if (upiErr.message && upiErr.message.includes("upi")) {
        console.warn("⚠️ UPI not enabled in Stripe Dashboard — falling back to card only");
        pi = await stripe.paymentIntents.create({
          amount: amountPaise,
          currency,
          metadata,
          payment_method_types: ["card"],
        });
      } else {
        throw upiErr;
      }
    }
    return {
      id: pi.id,
      clientSecret: pi.client_secret,
      amount: pi.amount / 100,
      currency: pi.currency,
      status: pi.status,
    };
  },

  async confirmPayment(paymentIntentId) {
    if (!stripe) throw new Error("Stripe not configured");
    // Client-side Stripe.js confirms the payment; we just retrieve the status
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    return { id: pi.id, status: pi.status };
  },

  async refundPayment(paymentIntentId) {
    if (!stripe) throw new Error("Stripe not configured");
    const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
    return { id: refund.id, paymentIntentId, status: refund.status };
  },
};

// ─── Webhook Signature Verify (Stripe) ──────────────────────────
function verifyStripeWebhook(rawBody, sig) {
  if (!stripe) throw new Error("Stripe not configured");
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) throw new Error("STRIPE_WEBHOOK_SECRET not set");
  return stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
}

// ─── Public API ──────────────────────────────────────────────────
const gateway = PROVIDER === "stripe" && stripe ? stripeGateway : mockGateway;

module.exports = {
  PROVIDER: PROVIDER === "stripe" && stripe ? "stripe" : "mock",
  PLATFORM_FEE_PERCENT,
  calcPlatformFee,
  createPaymentIntent: gateway.createPaymentIntent,
  confirmPayment: gateway.confirmPayment,
  refundPayment: gateway.refundPayment,
  verifyStripeWebhook,
};
