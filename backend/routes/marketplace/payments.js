// backend/routes/marketplace/payments.js
const express = require("express");
const router = express.Router();
const Order = require("../../models/Order");
const { protect } = require("../../middleware/authMiddleware");
const {
  createPaymentIntent,
  confirmPayment,
  refundPayment,
  verifyStripeWebhook,
  PROVIDER,
} = require("../../services/paymentService");

// GET /api/marketplace/payments/provider — which gateway is active
router.get("/provider", (req, res) => {
  res.json({ success: true, provider: PROVIDER });
});

// POST /api/marketplace/payments/create-intent — standalone intent (alternative to order flow)
router.post("/create-intent", protect, async (req, res) => {
  try {
    const { amount, currency = "usd" } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }
    const pi = await createPaymentIntent({
      amount: Number(amount),
      currency,
      metadata: { userId: req.userId },
    });
    res.json({ success: true, ...pi });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/marketplace/payments/refund — refund an order
router.post("/refund", protect, async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findOne({ _id: orderId, buyer: req.userId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.paymentStatus !== "succeeded") {
      return res.status(400).json({ success: false, message: "Order payment not succeeded — cannot refund" });
    }

    const result = await refundPayment(order.paymentIntentId);
    order.paymentStatus = "refunded";
    order.status = "refunded";
    order.statusHistory.push({ status: "refunded", note: `Refund ${result.id}` });
    await order.save();

    // Emit real-time
    try {
      const { getIO } = require("../../socket");
      getIO().emit("order:status:update", {
        orderId: order._id,
        status: order.status,
        paymentStatus: order.paymentStatus,
      });
    } catch (e) {}

    res.json({ success: true, refund: result, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/marketplace/payments/webhook — Stripe webhook handler
// Raw body is captured in server.js (req.rawBody)
router.post(
  "/webhook",
  async (req, res) => {
    if (PROVIDER !== "stripe") {
      return res.status(200).json({ received: true, note: "Mock mode — webhook ignored" });
    }
    try {
      const sig = req.headers["stripe-signature"];
      const payload = req.rawBody || req.body;
      const event = verifyStripeWebhook(payload, sig);

      switch (event.type) {
        case "payment_intent.succeeded": {
          const pi = event.data.object;
          const order = await Order.findOne({ paymentIntentId: pi.id });
          if (order && order.paymentStatus !== "succeeded") {
            order.paymentStatus = "succeeded";
            order.status = "confirmed";
            order.statusHistory.push({ status: "confirmed", note: "Webhook: payment succeeded" });
            await order.save();
            try {
              const { getIO } = require("../../socket");
              getIO().emit("order:status:update", {
                orderId: order._id,
                status: order.status,
                paymentStatus: order.paymentStatus,
              });
            } catch (e) {}
          }
          break;
        }
        case "payment_intent.payment_failed": {
          const pi = event.data.object;
          const order = await Order.findOne({ paymentIntentId: pi.id });
          if (order) {
            order.paymentStatus = "failed";
            order.statusHistory.push({ status: "failed", note: "Webhook: payment failed" });
            await order.save();
          }
          break;
        }
        default:
          break;
      }

      res.json({ received: true });
    } catch (err) {
      console.error("Webhook error:", err.message);
      res.status(400).json({ error: err.message });
    }
  }
);

module.exports = router;
