// backend/routes/marketplace/reviews.js
const express = require("express");
const router = express.Router();
const Review = require("../../models/Review");
const Order = require("../../models/Order");
const { protect } = require("../../middleware/authMiddleware");

// GET /api/marketplace/reviews/:productId — list reviews for a product
router.get("/:productId", async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = "newest" } = req.query;
    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      highest: { rating: -1 },
      lowest: { rating: 1 },
    };
    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const [reviews, total] = await Promise.all([
      Review.find({ product: req.params.productId })
        .sort(sortMap[sort] || sortMap.newest)
        .skip(skip)
        .limit(Number(limit))
        .populate("user", "name avatar")
        .lean(),
      Review.countDocuments({ product: req.params.productId }),
    ]);

    // Rating distribution
    const distribution = await Review.aggregate([
      { $match: { product: new (require("mongoose").Types.ObjectId)(req.params.productId) } },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);

    res.json({
      success: true,
      reviews,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      totalCount: total,
      distribution: distribution.map((d) => ({ rating: d._id, count: d.count })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/marketplace/reviews — create a review
router.post("/", protect, async (req, res) => {
  try {
    const { productId, rating, title, body } = req.body;
    if (!productId || !rating) {
      return res.status(400).json({ success: false, message: "productId and rating required" });
    }

    // Check if already reviewed
    const exists = await Review.findOne({ product: productId, user: req.userId });
    if (exists) {
      return res.status(400).json({ success: false, message: "You have already reviewed this product" });
    }

    // Check if user has purchased this product (verified review)
    const purchased = await Order.findOne({
      buyer: req.userId,
      "items.product": productId,
      paymentStatus: "succeeded",
    });

    const review = await Review.create({
      product: productId,
      user: req.userId,
      rating: Number(rating),
      title: title || "",
      body: body || "",
      verified: !!purchased,
    });

    await review.populate("user", "name avatar");
    res.status(201).json({ success: true, review });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "You have already reviewed this product" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/marketplace/reviews/:id — delete own review
router.delete("/:id", protect, async (req, res) => {
  try {
    const review = await Review.findOneAndDelete({
      _id: req.params.id,
      user: req.userId,
    });
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });
    res.json({ success: true, message: "Review deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
