// backend/routes/marketplace/index.js
// Aggregates all marketplace sub-routes under /api/marketplace
const express = require("express");
const router = express.Router();

const productsRoutes = require("./products");
const cartRoutes = require("./cart");
const ordersRoutes = require("./orders");
const paymentsRoutes = require("./payments");
const reviewsRoutes = require("./reviews");
const sellerRoutes = require("./seller");
const downloadsRoutes = require("./downloads");

router.use("/products", productsRoutes);
router.use("/cart", cartRoutes);
router.use("/orders", ordersRoutes);
router.use("/payments", paymentsRoutes);
router.use("/reviews", reviewsRoutes);
router.use("/seller", sellerRoutes);
router.use("/downloads", downloadsRoutes);

module.exports = router;
