// backend/routes/marketplace/products.js
const express = require("express");
const router = express.Router();
const Product = require("../../models/Product");
const { protect } = require("../../middleware/authMiddleware");

// GET /api/marketplace/products — public listing with search, filter, sort, pagination
router.get("/", async (req, res) => {
  try {
    const {
      q,           // text search
      category,
      minPrice,
      maxPrice,
      format,
      sort = "newest",
      page = 1,
      limit = 24,
      featured,
      seller,
    } = req.query;

    const filter = { status: "active" };

    // Text search
    if (q) filter.$text = { $search: q };

    // Category
    if (category && category !== "all") filter.category = category;

    // Price range
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Format
    if (format) filter.format = format;

    // Featured
    if (featured === "true") filter.featured = true;

    // Seller
    if (seller) filter.seller = seller;

    // Sort
    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      rating: { avgRating: -1 },
      popular: { sold: -1 },
    };
    const sortObj = sortMap[sort] || sortMap.newest;

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const lim = Math.min(100, Math.max(1, Number(limit)));

    const [products, totalCount] = await Promise.all([
      Product.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(lim)
        .populate("seller", "name avatar")
        .lean(),
      Product.countDocuments(filter),
    ]);

    res.json({
      success: true,
      products,
      page: Number(page),
      totalPages: Math.ceil(totalCount / lim),
      totalCount,
    });
  } catch (err) {
    console.error("Marketplace products list error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/marketplace/products/categories — category counts
router.get("/categories", async (req, res) => {
  try {
    const cats = await Product.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ success: true, categories: cats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/marketplace/products/:idOrSlug — single product detail
router.get("/:idOrSlug", async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let product;
    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      product = await Product.findById(idOrSlug)
        .populate("seller", "name avatar email");
    } else {
      product = await Product.findOne({ slug: idOrSlug, status: "active" })
        .populate("seller", "name avatar email");
    }
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
