// src/pages/marketplace/CartPage.jsx
import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useMarketplaceStore } from "../../store/MarketplaceStore";
import Breadcrumbs from "../../components/marketplace/Breadcrumbs";
import { ShoppingBag, Trash2, Minus, Plus } from "lucide-react";
import "../../styles/marketplace.css";

export default function CartPage() {
  usePageTitle("Shopping Cart");
  const { cart, fetchCart, removeFromCart, updateCartItem, clearCart } = useMarketplaceStore();

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const items = cart?.items || [];
  const formatPrice = (p) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(p);

  const total = items.reduce((sum, item) => {
    const price = item.product?.price ?? item.priceAtAdd ?? 0;
    return sum + price * item.quantity;
  }, 0);

  return (
    <div className="mp-page">
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Marketplace", to: "/marketplace" },
          { label: "Cart" },
        ]}
      />

      <h1 className="mp-page-title">
        <ShoppingBag size={28} /> Your Cart
      </h1>

      {items.length === 0 ? (
        <div className="mp-empty">
          <ShoppingBag size={64} strokeWidth={1} />
          <h2>Your cart is empty</h2>
          <Link to="/marketplace" className="mp-btn mp-btn-primary">
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <div className="mp-cart-layout">
          <div className="mp-cart-table">
            <div className="mp-cart-table-header">
              <span>Product</span>
              <span>Price</span>
              <span>Qty</span>
              <span>Subtotal</span>
              <span />
            </div>
            {items.map((item) => {
              const p = item.product || {};
              const price = p.price ?? item.priceAtAdd ?? 0;
              return (
                <div key={item._id} className="mp-cart-row">
                  <div className="mp-cart-row-product">
                    {p.thumbnail ? (
                      <img src={p.thumbnail} alt={p.title} className="mp-cart-row-img" />
                    ) : (
                      <div className="mp-cart-row-placeholder" />
                    )}
                    <Link
                      to={`/marketplace/product/${p.slug || p._id}`}
                      className="mp-cart-row-title"
                    >
                      {p.title || "Product"}
                    </Link>
                  </div>
                  <span className="mp-cart-row-price">{formatPrice(price)}</span>
                  <div className="mp-cart-row-qty">
                    <button
                      className="mp-qty-btn"
                      onClick={() => updateCartItem(p._id || item.product, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                    >
                      <Minus size={14} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      className="mp-qty-btn"
                      onClick={() => updateCartItem(p._id || item.product, item.quantity + 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="mp-cart-row-subtotal">
                    {formatPrice(price * item.quantity)}
                  </span>
                  <button
                    className="mp-cart-row-remove"
                    onClick={() => removeFromCart(p._id || item.product)}
                    aria-label="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>

          <aside className="mp-cart-summary-panel">
            <h3>Order Summary</h3>
            <div className="mp-summary-row">
              <span>Subtotal ({items.length} item{items.length > 1 ? "s" : ""})</span>
              <span>{formatPrice(total)}</span>
            </div>
            <div className="mp-summary-row mp-summary-total">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>
            <Link to="/marketplace/checkout" className="mp-btn mp-btn-primary mp-btn-full">
              Proceed to Checkout
            </Link>
            <button className="mp-btn mp-btn-ghost mp-btn-full" onClick={clearCart}>
              Clear Cart
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
