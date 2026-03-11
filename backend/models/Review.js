// backend/models/Review.js
const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120, default: "" },
    body: { type: String, trim: true, maxlength: 2000, default: "" },
    verified: { type: Boolean, default: false }, // user actually purchased
  },
  { timestamps: true }
);

// One review per user per product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });
reviewSchema.index({ product: 1, createdAt: -1 });

// After save: recalculate product's avgRating + reviewCount
reviewSchema.statics.calcAverageRating = async function (productId) {
  const Product = mongoose.model("Product");
  const result = await this.aggregate([
    { $match: { product: productId } },
    {
      $group: {
        _id: "$product",
        avgRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  if (result.length > 0) {
    await Product.findByIdAndUpdate(productId, {
      avgRating: Math.round(result[0].avgRating * 10) / 10,
      reviewCount: result[0].reviewCount,
    });
  } else {
    await Product.findByIdAndUpdate(productId, {
      avgRating: 0,
      reviewCount: 0,
    });
  }
};

reviewSchema.post("save", function () {
  this.constructor.calcAverageRating(this.product);
});

reviewSchema.post("findOneAndDelete", function (doc) {
  if (doc) doc.constructor.calcAverageRating(doc.product);
});

module.exports = mongoose.model("Review", reviewSchema);
