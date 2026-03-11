// backend/routes/marketplace/orders.js
const express = require("express");
const router = express.Router();
const Order = require("../../models/Order");
const Cart = require("../../models/Cart");
const Product = require("../../models/Product");
const { protect } = require("../../middleware/authMiddleware");
const {
  createPaymentIntent,
  confirmPayment,
  calcPlatformFee,
  PROVIDER,
} = require("../../services/paymentService");
const { generateOrderDownloadLinks } = require("../../services/downloadService");

router.use(protect);

// POST /api/marketplace/orders — create order from cart
router.post("/", async (req, res) => {
  try {
    const { paymentMethod = "mock" } = req.body;

    const cart = await Cart.findOne({ user: req.userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // Validate all products still available
    const orderItems = [];
    let subtotal = 0;
    const sellerAmounts = {};

    for (const item of cart.items) {
      const p = item.product;
      if (!p || p.status !== "active") {
        return res.status(400).json({
          success: false,
          message: `Product "${p?.title || "unknown"}" is no longer available`,
        });
      }
      const lineTotal = p.price * item.quantity;
      subtotal += lineTotal;

      orderItems.push({
        product: p._id,
        title: p.title,
        thumbnail: p.thumbnail,
        price: p.price,
        quantity: item.quantity,
      });

      const sid = p.seller.toString();
      sellerAmounts[sid] = (sellerAmounts[sid] || 0) + lineTotal;
    }

    const platformFee = calcPlatformFee(subtotal);
    const total = subtotal; // buyer pays full subtotal; platform fee is deducted from seller payout

    // Create payment intent
    const pi = await createPaymentIntent({
      amount: total,
      currency: "inr",
      metadata: { userId: req.userId },
    });

    // Build seller payouts
    const sellerPayouts = Object.entries(sellerAmounts).map(([sellerId, amount]) => ({
      seller: sellerId,
      amount: Math.round((amount - calcPlatformFee(amount)) * 100) / 100,
      status: "pending",
    }));

    const order = await Order.create({
      buyer: req.userId,
      items: orderItems,
      subtotal,
      platformFee,
      total,
      paymentMethod: PROVIDER === "stripe" ? "stripe" : paymentMethod,
      paymentIntentId: pi.id,
      paymentStatus: "pending",
      status: "pending",
      statusHistory: [{ status: "pending", note: "Order created" }],
      sellerPayouts,
    });

    // Emit real-time event
    try {
      const { getIO } = require("../../socket");
      const io = getIO();
      io.emit("order:created", {
        orderId: order._id,
        buyer: req.userId,
        total,
        itemCount: orderItems.length,
      });
    } catch (e) {
      /* socket not available */
    }

    res.status(201).json({
      success: true,
      order,
      clientSecret: pi.clientSecret,
      paymentProvider: PROVIDER,
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/marketplace/orders/:id/confirm — confirm payment and finalize order
router.post("/:id/confirm", async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, buyer: req.userId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.paymentStatus === "succeeded") {
      return res.json({ success: true, order, message: "Payment already confirmed" });
    }

    // Confirm with payment provider
    const result = await confirmPayment(order.paymentIntentId);

    if (result.status === "succeeded") {
      order.paymentStatus = "succeeded";
      order.status = "confirmed";
      order.statusHistory.push({ status: "confirmed", note: "Payment confirmed" });

      // Update product sold counts & generate download links
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { sold: item.quantity },
        });
      }

      // Generate signed download links
      order.downloadLinks = generateOrderDownloadLinks(order);

      // Attach license info from products
      for (const dl of order.downloadLinks) {
        const product = await Product.findById(dl.product).select("license").lean();
        if (product?.license) dl.license = product.license;
      }

      // Clear cart
      await Cart.findOneAndDelete({ user: req.userId });

      await order.save();

      // Emit real-time event
      try {
        const { getIO } = require("../../socket");
        const io = getIO();
        io.emit("order:status:update", {
          orderId: order._id,
          status: order.status,
          paymentStatus: order.paymentStatus,
        });

        // Notify inventory changes
        for (const item of order.items) {
          io.emit("inventory:update", {
            productId: item.product,
            sold: item.quantity,
          });
        }
      } catch (e) {
        /* socket not available */
      }

      return res.json({ success: true, order });
    }

    // Payment failed
    order.paymentStatus = "failed";
    order.statusHistory.push({ status: "failed", note: result.error || "Payment failed" });
    await order.save();

    res.status(402).json({ success: false, message: result.error || "Payment failed", order });
  } catch (err) {
    console.error("Confirm order error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/marketplace/orders — list buyer's orders
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const filter = { buyer: req.userId };
    if (status) filter.status = status;

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("items.product", "title thumbnail slug")
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.json({
      success: true,
      orders,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      totalCount: total,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/marketplace/orders/:id — single order detail
router.get("/:id", async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, buyer: req.userId })
      .populate("items.product", "title thumbnail slug fileUrl")
      .populate("buyer", "name email");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
