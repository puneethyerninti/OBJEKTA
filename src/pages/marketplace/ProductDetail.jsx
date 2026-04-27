// src/pages/marketplace/ProductDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useMarketplaceStore } from "../../store/MarketplaceStore";
import Breadcrumbs from "../../components/marketplace/Breadcrumbs";
import StarRating from "../../components/marketplace/StarRating";
import ReviewSection from "../../components/marketplace/ReviewSection";
import CartSidebar from "../../components/marketplace/CartSidebar";
import {
  ShoppingCart,
  Download,
  Box,
  Layers,
  Palette,
  Move3d,
  Film,
  Shield,
  User,
} from "lucide-react";
import ModelPreview3D from "../../components/marketplace/ModelPreview3D";
import "../../styles/marketplace.css";

export default function ProductDetail() {
  usePageTitle("Product");
  const { idOrSlug } = useParams();
  const { productDetail, productsLoading, fetchProductDetail, addToCart, cart } =
    useMarketplaceStore();
  const [cartOpen, setCartOpen] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    if (idOrSlug) fetchProductDetail(idOrSlug);
  }, [idOrSlug, fetchProductDetail]);

  const handleAddToCart = async () => {
    if (!productDetail) return;
    const res = await addToCart(productDetail._id);
    if (res.ok) {
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    }
  };

  const formatPrice = (p) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(p);

  if (productsLoading || !productDetail) {
    return (
      <div className="mp-page">
        <div className="mp-loading">
          <div className="mp-spinner" />
          <p>Loading product…</p>
        </div>
      </div>
    );
  }

  const p = productDetail;

  return (
    <div className="mp-page">
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Marketplace", to: "/marketplace" },
          { label: p.category, to: `/marketplace?category=${p.category}` },
          { label: p.title },
        ]}
      />

      <div className="mp-detail-layout">
        {/* Left: Interactive 3D Viewer */}
        <div className="mp-detail-media">
          {p.fileUrl && p.format === "glb" ? (
            <ModelPreview3D
              url={p.fileUrl}
              autoRotate
              interactive
              height="480px"
              className="mp-detail-3d-viewer"
            />
          ) : p.thumbnail ? (
            <img src={p.thumbnail} alt={p.title} className="mp-detail-hero-img" />
          ) : (
            <div className="mp-detail-placeholder">
              <Box size={64} />
            </div>
          )}
        </div>

        {/* Right: Info + Buy */}
        <div className="mp-detail-info">
          <div className="mp-detail-badges">
            {p.featured && <span className="mp-badge mp-badge-featured">Featured</span>}
            <span className="mp-badge mp-badge-format">{p.format?.toUpperCase()}</span>
            <span className="mp-badge mp-badge-license">{p.license}</span>
          </div>

          <h1 className="mp-detail-title">{p.title}</h1>

          <div className="mp-detail-rating">
            <StarRating rating={p.avgRating} size={18} />
            <span>({p.reviewCount || 0} reviews)</span>
            <span className="mp-detail-sold">{p.sold || 0} sold</span>
          </div>

          <p className="mp-detail-price">{formatPrice(p.price)}</p>

          {/* Seller */}
          <div className="mp-detail-seller">
            <User size={16} />
            <span>
              Sold by{" "}
              <strong>{p.seller?.name || "Unknown Seller"}</strong>
            </span>
          </div>

          <p className="mp-detail-description">{p.description}</p>

          {/* Specs */}
          <div className="mp-detail-specs">
            <div className="mp-spec">
              <Layers size={16} />
              <span>{p.polyCount > 0 ? `${(p.polyCount / 1000).toFixed(1)}K polygons` : "N/A"}</span>
            </div>
            <div className="mp-spec">
              <Download size={16} />
              <span>{p.fileSize > 0 ? `${(p.fileSize / (1024 * 1024)).toFixed(1)} MB` : "N/A"}</span>
            </div>
            {p.textured && (
              <div className="mp-spec">
                <Palette size={16} />
                <span>Textured</span>
              </div>
            )}
            {p.rigged && (
              <div className="mp-spec">
                <Move3d size={16} />
                <span>Rigged</span>
              </div>
            )}
            {p.animated && (
              <div className="mp-spec">
                <Film size={16} />
                <span>Animated</span>
              </div>
            )}
            <div className="mp-spec">
              <Shield size={16} />
              <span>{p.license} license</span>
            </div>
          </div>

          {/* Tags */}
          {p.tags?.length > 0 && (
            <div className="mp-detail-tags">
              {p.tags.map((t) => (
                <span key={t} className="mp-tag">{t}</span>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="mp-detail-actions">
            <button
              className={`mp-btn mp-btn-primary mp-btn-lg ${addedToCart ? "mp-btn-success" : ""}`}
              onClick={handleAddToCart}
            >
              <ShoppingCart size={18} />
              {addedToCart ? "Added to Cart!" : "Add to Cart"}
            </button>
            <button
              className="mp-btn mp-btn-ghost"
              onClick={() => setCartOpen(true)}
            >
              View Cart ({cart?.items?.length || 0})
            </button>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <ReviewSection productId={p._id} />

      {/* Cart Sidebar */}
      <CartSidebar isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
