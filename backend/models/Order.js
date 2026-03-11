// backend/models/Order.js
const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  title: String,
  thumbnail: String,
  price: { type: Number, required: true },
  quantity: { type: Number, default: 1 },
});

const orderSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [orderItemSchema],
    subtotal: { type: Number, required: true },
    platformFee: { type: Number, default: 0 },      // 10% of subtotal
    total: { type: Number, required: true },
    currency: { type: String, default: "USD" },

    // Payment
    paymentMethod: {
      type: String,
      default: "mock",
      enum: ["mock", "stripe", "paypal"],
    },
    paymentIntentId: { type: String, default: "" },
    paymentStatus: {
      type: String,
      default: "pending",
      enum: ["pending", "processing", "succeeded", "failed", "refunded"],
    },

    // Order status
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "confirmed", "processing", "delivered", "cancelled", "refunded"],
    },
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: { type: String, default: "" },
      },
    ],

    // Delivery for digital goods
    downloadLinks: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        url: String,
        signedUrl: String,
        signedUrlExpires: Date,
        expiresAt: Date,
        downloadCount: { type: Number, default: 0 },
        maxDownloads: { type: Number, default: 5 },
        lastDownloadedAt: Date,
        license: { type: String, default: "standard", enum: ["standard", "extended", "exclusive"] },
      },
    ],

    // Seller breakdown (for multi-seller orders, track per-seller amounts)
    sellerPayouts: [
      {
        seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        amount: Number,
        status: { type: String, default: "pending", enum: ["pending", "paid"] },
      },
    ],
  },
  { timestamps: true }
);

orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ "items.product": 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model("Order", orderSchema);
