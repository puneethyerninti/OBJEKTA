// src/components/marketplace/CartSidebar.jsx
import React from "react";
import { Link } from "react-router-dom";
import { X, Trash2, ShoppingBag, Minus, Plus } from "lucide-react";
import { useMarketplaceStore } from "../../store/MarketplaceStore";

export default function CartSidebar({ isOpen, onClose }) {
  const { cart, removeFromCart, updateCartItem, cartLoading } = useMarketplaceStore();
  const items = cart?.items || [];

  const formatPrice = (p) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(p);

  const total = items.reduce((sum, item) => {
    const price = item.product?.price ?? item.priceAtAdd ?? 0;
    return sum + price * item.quantity;
  }, 0);

  return (
    <>
      {/* Overlay */}
      {isOpen && <div className="mp-cart-overlay" onClick={onClose} aria-hidden="true" />}

      <aside className={`mp-cart-sidebar ${isOpen ? "mp-cart-open" : ""}`} aria-label="Shopping cart">
        <div className="mp-cart-header">
          <h2 className="mp-cart-title">
            <ShoppingBag size={20} /> Cart ({items.length})
          </h2>
          <button className="mp-cart-close" onClick={onClose} aria-label="Close cart">
            <X size={20} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="mp-cart-empty">
            <ShoppingBag size={48} strokeWidth={1} />
            <p>Your cart is empty</p>
            <Link to="/marketplace" className="mp-btn mp-btn-primary" onClick={onClose}>
              Browse Marketplace
            </Link>
          </div>
        ) : (
          <>
            <div className="mp-cart-items">
              {items.map((item) => {
                const p = item.product || {};
                return (
                  <div key={item._id} className="mp-cart-item">
                    <div className="mp-cart-item-thumb">
                      {p.thumbnail ? (
                        <img src={p.thumbnail} alt={p.title} />
                      ) : (
                        <div className="mp-cart-item-placeholder" />
                      )}
                    </div>
                    <div className="mp-cart-item-info">
                      <Link
                        to={`/marketplace/product/${p.slug || p._id}`}
                        className="mp-cart-item-title"
                        onClick={onClose}
                      >
                        {p.title || "Product"}
                      </Link>
                      <span className="mp-cart-item-price">
                        {formatPrice(p.price ?? item.priceAtAdd)}
                      </span>
                      <div className="mp-cart-item-qty">
                        <button
                          className="mp-qty-btn"
                          onClick={() => updateCartItem(p._id || item.product, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={14} />
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          className="mp-qty-btn"
                          onClick={() => updateCartItem(p._id || item.product, item.quantity + 1)}
                          aria-label="Increase quantity"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    <button
                      className="mp-cart-item-remove"
                      onClick={() => removeFromCart(p._id || item.product)}
                      aria-label={`Remove ${p.title || "item"} from cart`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mp-cart-footer">
              <div className="mp-cart-total">
                <span>Total</span>
                <span className="mp-cart-total-price">{formatPrice(total)}</span>
              </div>
              <Link to="/marketplace/checkout" className="mp-btn mp-btn-primary mp-btn-full" onClick={onClose}>
                Proceed to Checkout
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
