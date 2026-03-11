// backend/routes/marketplace/downloads.js
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const Order = require("../../models/Order");
const Product = require("../../models/Product");
const { protect } = require("../../middleware/authMiddleware");
const { verifySignedToken, generateSignedDownloadUrl } = require("../../services/downloadService");

// GET /api/marketplace/downloads/:token — serve signed download
router.get("/:token", async (req, res) => {
  try {
    const decoded = verifySignedToken(req.params.token);
    if (!decoded) {
      return res.status(403).json({ success: false, message: "Invalid or expired download link" });
    }

    const { orderId, productId, userId } = decoded;

    // Find the order and validate ownership
    const order = await Order.findById(orderId);
    if (!order || order.buyer.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (order.paymentStatus !== "succeeded") {
      return res.status(403).json({ success: false, message: "Payment not confirmed" });
    }

    // Find the download link entry
    const dlEntry = order.downloadLinks.find(
      (dl) => dl.product.toString() === productId
    );

    if (!dlEntry) {
      return res.status(404).json({ success: false, message: "Download not found" });
    }

    // Check download limit
    if (dlEntry.downloadCount >= dlEntry.maxDownloads) {
      return res.status(403).json({ success: false, message: "Download limit reached" });
    }

    // Check overall expiry
    if (dlEntry.expiresAt && new Date() > dlEntry.expiresAt) {
      return res.status(403).json({ success: false, message: "Download link expired" });
    }

    // Get product file
    const product = await Product.findById(productId);
    if (!product || !product.fileUrl) {
      return res.status(404).json({ success: false, message: "Product file not found" });
    }

    // Increment download count
    dlEntry.downloadCount += 1;
    dlEntry.lastDownloadedAt = new Date();
    await order.save();

    // Serve the file
    const filePath = path.join(__dirname, "../../uploads", product.fileUrl.replace(/^\/uploads\//, ""));
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = ext === ".glb" ? "model/gltf-binary" : "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${product.slug || "asset"}${ext}"`);
      return fs.createReadStream(filePath).pipe(res);
    }

    // Fallback: redirect to fileUrl (might be external)
    return res.redirect(product.fileUrl);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ success: false, message: "Download failed" });
  }
});

// POST /api/marketplace/downloads/refresh/:orderId/:productId — regenerate signed URL
router.post("/refresh/:orderId/:productId", protect, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, buyer: req.userId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.paymentStatus !== "succeeded") {
      return res.status(403).json({ success: false, message: "Payment not confirmed" });
    }

    const dlEntry = order.downloadLinks.find(
      (dl) => dl.product.toString() === req.params.productId
    );
    if (!dlEntry) return res.status(404).json({ success: false, message: "Download not found" });

    // Check download limit
    if (dlEntry.downloadCount >= dlEntry.maxDownloads) {
      return res.status(403).json({ success: false, message: "Download limit reached" });
    }

    // Generate new signed URL
    const { signedUrl, expiresAt } = generateSignedDownloadUrl({
      orderId: req.params.orderId,
      productId: req.params.productId,
      userId: req.userId,
    });

    dlEntry.signedUrl = signedUrl;
    dlEntry.signedUrlExpires = expiresAt;
    await order.save();

    res.json({ success: true, signedUrl, expiresAt });
  } catch (err) {
    console.error("Refresh download error:", err);
    res.status(500).json({ success: false, message: "Failed to refresh download" });
  }
});

module.exports = router;
