// backend/socket/marketplace.js
// Marketplace-specific Socket.IO events
// Called from initSocket in backend/socket.js

function registerMarketplaceEvents(io, socket) {
  // Seller can join their own "seller room" for order notifications
  socket.on("marketplace:join-seller", (sellerId) => {
    if (sellerId) {
      socket.join(`seller:${sellerId}`);
      console.log(`🛒 Socket ${socket.id} joined seller room: seller:${sellerId}`);
    }
  });

  socket.on("marketplace:leave-seller", (sellerId) => {
    if (sellerId) {
      socket.leave(`seller:${sellerId}`);
    }
  });

  // Buyer can join an order room for live tracking
  socket.on("marketplace:track-order", (orderId) => {
    if (orderId) {
      socket.join(`order:${orderId}`);
      console.log(`📦 Socket ${socket.id} tracking order: ${orderId}`);
    }
  });

  socket.on("marketplace:untrack-order", (orderId) => {
    if (orderId) {
      socket.leave(`order:${orderId}`);
    }
  });
}

// Utility: emit marketplace events from backend routes
function emitOrderCreated(io, orderData) {
  // Broadcast to all (for general activity feed)
  io.emit("order:created", orderData);

  // Notify specific sellers
  if (orderData.sellerIds) {
    for (const sellerId of orderData.sellerIds) {
      io.to(`seller:${sellerId}`).emit("seller:new-order", orderData);
    }
  }
}

function emitOrderStatusUpdate(io, { orderId, status, paymentStatus }) {
  io.emit("order:status:update", { orderId, status, paymentStatus });
  io.to(`order:${orderId}`).emit("order:status:update", { orderId, status, paymentStatus });
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
