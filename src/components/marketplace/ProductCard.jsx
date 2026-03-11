// src/components/marketplace/ProductCard.jsx
import React from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Star, Eye, Box } from "lucide-react";
import StarRating from "./StarRating";
import { useMarketplaceStore } from "../../store/MarketplaceStore";

export default function ProductCard({ product }) {
  const addToCart = useMarketplaceStore((s) => s.addToCart);

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const result = await addToCart(product._id);
    if (!result.ok) {
      console.warn("Add to cart failed:", result.error);
    }
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(price);

  return (
    <article className="mp-product-card" aria-label={product.title}>
      <Link to={`/marketplace/product/${product.slug || product._id}`} className="mp-product-link">
        {/* Static thumbnail — 3D only on detail page */}
        <div className="mp-product-thumb">
          <div className="mp-product-3d-poster">
            <Box size={40} strokeWidth={1} />
            <span className="mp-product-3d-label">3D</span>
          </div>
          {product.featured && <span className="mp-badge mp-badge-featured">Featured</span>}
          {product.animated && <span className="mp-badge mp-badge-animated">Animated</span>}
        </div>

        {/* Info */}
        <div className="mp-product-info">
          <h3 className="mp-product-title">{product.title}</h3>

          <div className="mp-product-meta">
            <StarRating rating={product.avgRating} size={14} />
            <span className="mp-product-reviews">({product.reviewCount || 0})</span>
          </div>

          <div className="mp-product-details">
            <span className="mp-product-format">{product.format?.toUpperCase()}</span>
            {product.polyCount > 0 && (
              <span className="mp-product-poly">{(product.polyCount / 1000).toFixed(1)}K polys</span>
            )}
          </div>

          <div className="mp-product-footer">
            <span className="mp-product-price">{formatPrice(product.price)}</span>
            <button
              className="mp-btn mp-btn-cart-sm"
              onClick={handleAddToCart}
              aria-label={`Add ${product.title} to cart`}
              title="Add to Cart"
            >
              <ShoppingCart size={16} />
            </button>
          </div>
        </div>
      </Link>
    </article>
  );
}
