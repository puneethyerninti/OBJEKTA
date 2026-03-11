// backend/models/Product.js
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "", maxlength: 5000 },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR", enum: ["INR", "USD"] },
    category: {
      type: String,
      default: "other",
      enum: [
        "characters",
        "vehicles",
        "architecture",
        "furniture",
        "nature",
        "weapons",
        "props",
        "environments",
        "animations",
        "other",
      ],
    },
    tags: [{ type: String, trim: true, lowercase: true }],

    // 3D asset details
    format: { type: String, default: "glb", enum: ["glb", "gltf", "fbx", "obj", "usdz"] },
    fileUrl: { type: String, default: "" },        // download URL after purchase
    fileSize: { type: Number, default: 0 },        // bytes
    polyCount: { type: Number, default: 0 },
    textured: { type: Boolean, default: false },
    rigged: { type: Boolean, default: false },
    animated: { type: Boolean, default: false },

    // Images
    thumbnail: { type: String, default: "" },
    images: [{ type: String }],
    previewUrl: { type: String, default: "" },     // 3D preview embed URL

    // Seller
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Inventory & sales
    stock: { type: Number, default: -1 },          // -1 = unlimited (digital)
    sold: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    status: {
      type: String,
      default: "active",
      enum: ["draft", "active", "inactive", "removed"],
    },

    // Ratings (denormalized for fast reads)
    avgRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },

    // License
    license: {
      type: String,
      default: "standard",
      enum: ["standard", "extended", "exclusive"],
    },
  },
  { timestamps: true }
);

// Auto-generate slug from title
productSchema.pre("validate", function (next) {
  if (this.isModified("title") && !this.slug) {
    this.slug =
      this.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") +
      "-" +
      Date.now().toString(36);
  }
  next();
});

// Indexes for search & filtering
productSchema.index({ title: "text", description: "text", tags: "text" });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ seller: 1 });
productSchema.index({ slug: 1 });
productSchema.index({ price: 1 });
productSchema.index({ avgRating: -1 });
productSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Product", productSchema);
