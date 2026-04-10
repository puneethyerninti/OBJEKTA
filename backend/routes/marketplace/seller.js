// backend/routes/marketplace/seller.js
const express = require("express");
const router = express.Router();
const Product = require("../../models/Product");
const Order = require("../../models/Order");
const { protect, authorize } = require("../../middleware/authMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure marketplace upload directories
const marketDir = path.join(__dirname, "../../uploads/marketplace");
const thumbDir = path.join(__dirname, "../../uploads/marketplace/thumbnails");
[marketDir, thumbDir].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "thumbnail") return cb(null, thumbDir);
    return cb(null, marketDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "thumbnail") {
      const ext = path.extname(file.originalname).toLowerCase();
      if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) return cb(null, true);
      return cb(new Error("Thumbnail must be an image (jpg/png/webp/gif)"));
    }
    // Asset file — allow 3D formats + zip
    const ext = path.extname(file.originalname).toLowerCase();
    if ([".glb", ".gltf", ".fbx", ".obj", ".usdz", ".zip"].includes(ext)) return cb(null, true);
    return cb(new Error("Invalid file type for 3D asset"));
  },
});

// All seller routes require auth
router.use(protect);
router.use(authorize("seller", "admin"));

// GET /api/marketplace/seller/products — list seller's own products
router.get("/products", async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = { seller: req.userId };
    if (status) filter.status = status;

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Product.countDocuments(filter),
    ]);

    res.json({
      success: true,
      products,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      totalCount: total,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/marketplace/seller/stats — seller dashboard stats
router.get("/stats", async (req, res) => {
  try {
    const sellerProducts = await Product.find({ seller: req.userId }).select("_id").lean();
    const productIds = sellerProducts.map((p) => p._id);

    const [totalProducts, totalSold, revenueAgg] = await Promise.all([
      Product.countDocuments({ seller: req.userId }),
      Product.aggregate([
        { $match: { seller: new (require("mongoose").Types.ObjectId)(req.userId) } },
        { $group: { _id: null, total: { $sum: "$sold" } } },
      ]),
      Order.aggregate([
        { $match: { "items.product": { $in: productIds }, paymentStatus: "succeeded" } },
        { $unwind: "$items" },
        { $match: { "items.product": { $in: productIds } } },
        {
          $group: {
            _id: null,
            revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
            orderCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const platformFeePercent = Number(process.env.PLATFORM_FEE_PERCENT || "10");
    const grossRevenue = revenueAgg[0]?.revenue || 0;
    const netRevenue = Math.round(grossRevenue * (1 - platformFeePercent / 100) * 100) / 100;

    res.json({
      success: true,
      stats: {
        totalProducts,
        totalSold: totalSold[0]?.total || 0,
        grossRevenue,
        netRevenue,
        platformFeePercent,
        orderCount: revenueAgg[0]?.orderCount || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/marketplace/seller/orders — orders containing seller's products
router.get("/orders", async (req, res) => {
  try {
    const sellerProducts = await Product.find({ seller: req.userId }).select("_id").lean();
    const productIds = sellerProducts.map((p) => p._id);

    const { page = 1, limit = 10 } = req.query;
    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const orders = await Order.find({ "items.product": { $in: productIds } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("buyer", "name email")
      .populate("items.product", "title thumbnail slug")
      .lean();

    const total = await Order.countDocuments({ "items.product": { $in: productIds } });

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

// POST /api/marketplace/seller/products — create product listing
router.post(
  "/products",
  upload.fields([
    { name: "asset", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        title,
        description,
        price,
        category,
        tags,
        format,
        polyCount,
        textured,
        rigged,
        animated,
        license,
        status: prodStatus,
      } = req.body;

      if (!title || !price) {
        return res.status(400).json({ success: false, message: "Title and price are required" });
      }

      const productData = {
        title,
        description: description || "",
        price: Number(price),
        category: category || "other",
        tags: tags ? (typeof tags === "string" ? tags.split(",").map((t) => t.trim()) : tags) : [],
        format: format || "glb",
        polyCount: Number(polyCount) || 0,
        textured: textured === "true" || textured === true,
        rigged: rigged === "true" || rigged === true,
        animated: animated === "true" || animated === true,
        license: license || "standard",
        seller: req.userId,
        status: prodStatus || "active",
      };

      if (req.files?.asset?.[0]) {
        productData.fileUrl = `/uploads/marketplace/${req.files.asset[0].filename}`;
        productData.fileSize = req.files.asset[0].size;
      }
      if (req.files?.thumbnail?.[0]) {
        productData.thumbnail = `/uploads/marketplace/thumbnails/${req.files.thumbnail[0].filename}`;
      }

      const product = await Product.create(productData);

      // Emit inventory event
      try {
        const { getIO } = require("../../socket");
        getIO().emit("inventory:update", {
          type: "new_product",
          productId: product._id,
          title: product.title,
          seller: req.userId,
        });
      } catch (e) {}

      res.status(201).json({ success: true, product });
    } catch (err) {
      console.error("Create product error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PUT /api/marketplace/seller/products/:id — update product
router.put(
  "/products/:id",
  upload.fields([
    { name: "asset", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const product = await Product.findOne({ _id: req.params.id, seller: req.userId });
      if (!product) return res.status(404).json({ success: false, message: "Product not found" });

      const fields = [
        "title", "description", "price", "category", "format",
        "polyCount", "textured", "rigged", "animated", "license", "status",
      ];
      for (const f of fields) {
        if (req.body[f] !== undefined) {
          if (["price", "polyCount"].includes(f)) product[f] = Number(req.body[f]);
          else if (["textured", "rigged", "animated"].includes(f))
            product[f] = req.body[f] === "true" || req.body[f] === true;
          else product[f] = req.body[f];
        }
      }
      if (req.body.tags) {
        product.tags =
          typeof req.body.tags === "string"
            ? req.body.tags.split(",").map((t) => t.trim())
            : req.body.tags;
      }
      if (req.files?.asset?.[0]) {
        product.fileUrl = `/uploads/marketplace/${req.files.asset[0].filename}`;
        product.fileSize = req.files.asset[0].size;
      }
      if (req.files?.thumbnail?.[0]) {
        product.thumbnail = `/uploads/marketplace/thumbnails/${req.files.thumbnail[0].filename}`;
      }

      await product.save();
      res.json({ success: true, product });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// DELETE /api/marketplace/seller/products/:id — soft delete (set status to removed)
router.delete("/products/:id", async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, seller: req.userId },
      { status: "removed" },
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    res.json({ success: true, message: "Product removed", product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
