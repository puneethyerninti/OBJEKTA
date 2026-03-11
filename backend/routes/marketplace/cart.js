// backend/routes/marketplace/cart.js
const express = require("express");
const router = express.Router();
const Cart = require("../../models/Cart");
const Product = require("../../models/Product");
const { protect } = require("../../middleware/authMiddleware");

// All cart routes require auth
router.use(protect);

// GET /api/marketplace/cart — get current user's cart
router.get("/", async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.userId }).populate(
      "items.product",
      "title thumbnail price slug status stock seller"
    );
    if (!cart) cart = { items: [], total: 0 };
    res.json({ success: true, cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/marketplace/cart/add — add item
router.post("/add", async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: "productId required" });

    const product = await Product.findById(productId);
    if (!product || product.status !== "active")
      return res.status(404).json({ success: false, message: "Product not found or unavailable" });

    let cart = await Cart.findOne({ user: req.userId });
    if (!cart) cart = new Cart({ user: req.userId, items: [] });

    const existing = cart.items.find((i) => i.product.toString() === productId);
    if (existing) {
      // For digital goods, usually qty=1 is enough; allow increment anyway
      existing.quantity += Number(quantity);
      existing.priceAtAdd = product.price; // refresh price snapshot
    } else {
      cart.items.push({
        product: productId,
        quantity: Number(quantity),
        priceAtAdd: product.price,
      });
    }

    await cart.save();
    await cart.populate("items.product", "title thumbnail price slug status stock seller");
    res.json({ success: true, cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/marketplace/cart/update — update item quantity
router.put("/update", async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const cart = await Cart.findOne({ user: req.userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    const item = cart.items.find((i) => i.product.toString() === productId);
    if (!item) return res.status(404).json({ success: false, message: "Item not in cart" });

    if (quantity <= 0) {
      cart.items = cart.items.filter((i) => i.product.toString() !== productId);
    } else {
      item.quantity = Number(quantity);
    }

    await cart.save();
    await cart.populate("items.product", "title thumbnail price slug status stock seller");
    res.json({ success: true, cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/marketplace/cart/remove/:productId — remove item
router.delete("/remove/:productId", async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    cart.items = cart.items.filter(
      (i) => i.product.toString() !== req.params.productId
    );
    await cart.save();
    await cart.populate("items.product", "title thumbnail price slug status stock seller");
    res.json({ success: true, cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/marketplace/cart — clear entire cart
router.delete("/", async (req, res) => {
  try {
    await Cart.findOneAndDelete({ user: req.userId });
    res.json({ success: true, message: "Cart cleared" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
