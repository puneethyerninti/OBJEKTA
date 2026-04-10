// backend/socket/marketplace.js
// Marketplace-specific Socket.IO events
// Called from initSocket in backend/socket.js

const Order = require("../models/Order");
const Product = require("../models/Product");

async function canTrackOrder(orderId, userId, userRole) {
  if (!orderId || !userId) return false;
  if (userRole === "admin") return true;

  const order = await Order.findById(orderId).select("buyer items.product").lean();
  if (!order) return false;

  if (String(order.buyer) === String(userId)) return true;
  if (userRole !== "seller") return false;

  const productIds = (order.items || []).map((item) => item?.product).filter(Boolean);
  if (!productIds.length) return false;
  const ownedCount = await Product.countDocuments({ _id: { $in: productIds }, seller: userId });
  return ownedCount > 0;
}

function registerMarketplaceEvents(io, socket, authContext = {}) {
  const userId = authContext.userId;
  const userRole = authContext.userRole;

  // Seller can join their own "seller room" for order notifications
  socket.on("marketplace:join-seller", (sellerId) => {
    try {
      const requested = String(sellerId || userId || "");
      if (!requested || !userId) return;
      if (userRole !== "seller" && userRole !== "admin") return;
      if (userRole !== "admin" && requested !== String(userId)) return;
      socket.join(`seller:${requested}`);
      console.log(`🛒 Socket ${socket.id} joined seller room: seller:${requested}`);
    } catch (err) {
      // ignore malformed payloads
    }
  });

  socket.on("marketplace:leave-seller", (sellerId) => {
    const requested = String(sellerId || userId || "");
    if (!requested || !userId) return;
    if (userRole !== "seller" && userRole !== "admin") return;
    if (userRole !== "admin" && requested !== String(userId)) return;
    socket.leave(`seller:${requested}`);
  });

  // Buyer can join an order room for live tracking
  socket.on("marketplace:track-order", async (orderId) => {
    const normalizedOrderId = String(orderId || "").trim();
    if (!normalizedOrderId) return;
    const allowed = await canTrackOrder(normalizedOrderId, userId, userRole);
    if (!allowed) {
      socket.emit("marketplace:error", { message: "Forbidden order tracking", orderId: normalizedOrderId });
      return;
    }
    socket.join(`order:${normalizedOrderId}`);
    console.log(`📦 Socket ${socket.id} tracking order: ${normalizedOrderId}`);
  });

  socket.on("marketplace:untrack-order", (orderId) => {
    const normalizedOrderId = String(orderId || "").trim();
    if (!normalizedOrderId) return;
    socket.leave(`order:${normalizedOrderId}`);
  });
}

// Utility: emit marketplace events from backend routes
function emitOrderCreated(io, orderData) {
  // Notify buyer dashboard
  if (orderData?.buyer) {
    io.to(`user:${orderData.buyer}`).emit("order:created", orderData);
  }

  // Notify specific sellers
  if (orderData.sellerIds) {
    for (const sellerId of orderData.sellerIds) {
      io.to(`seller:${sellerId}`).emit("seller:new-order", orderData);
    }
  }
}

function emitOrderStatusUpdate(io, { orderId, status, paymentStatus, buyerId = null, sellerIds = [] }) {
  if (!orderId) return;
  const payload = { orderId, status, paymentStatus };
  io.to(`order:${orderId}`).emit("order:status:update", payload);
  if (buyerId) io.to(`user:${buyerId}`).emit("order:status:update", payload);
  if (Array.isArray(sellerIds)) {
    sellerIds.forEach((sellerId) => {
      if (sellerId) io.to(`seller:${sellerId}`).emit("order:status:update", payload);
    });
  }
}

function emitInventoryUpdate(io, data) {
  io.emit("inventory:update", data);
}

module.exports = {
  registerMarketplaceEvents,
  emitOrderCreated,
  emitOrderStatusUpdate,
  emitInventoryUpdate,
};
