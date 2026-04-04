// src/pages/marketplace/CheckoutPage.jsx
import React, { useEffect } from "react";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useMarketplaceStore } from "../../store/MarketplaceStore";
import Breadcrumbs from "../../components/marketplace/Breadcrumbs";
import CheckoutForm from "../../components/marketplace/CheckoutForm";
import { useAuth } from "../../contexts/AuthContext";
import { Link, Navigate } from "react-router-dom";
import { Lock } from "lucide-react";
import "../../styles/marketplace.css";

export default function CheckoutPage() {
  usePageTitle("Checkout");
  const { user } = useAuth();
  const { cart, fetchCart } = useMarketplaceStore();

  useEffect(() => {
    fetchCart();
  }, []);

  if (!user) return <Navigate to="/login" replace />;

  const items = cart?.items || [];

  return (
    <div className="mp-page">
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Marketplace", to: "/marketplace" },
          { label: "Cart", to: "/marketplace/cart" },
          { label: "Checkout" },
        ]}
      />

      <h1 className="mp-page-title">
        <Lock size={24} /> Checkout
      </h1>

      {items.length === 0 ? (
        <div className="mp-empty">
          <p>Your cart is empty. Add some items before checkout.</p>
          <Link to="/marketplace" className="mp-btn mp-btn-primary">
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <div className="mp-checkout-layout">
          <CheckoutForm />
        </div>
      )}
    </div>
  );
}
