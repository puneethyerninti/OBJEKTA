// src/pages/marketplace/MarketplacePage.jsx
import React, { useEffect, useState } from "react";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useMarketplaceStore } from "../../store/MarketplaceStore";
import ProductCard from "../../components/marketplace/ProductCard";
import ProductFilters from "../../components/marketplace/ProductFilters";
import SearchBar from "../../components/marketplace/SearchBar";
import Pagination from "../../components/marketplace/Pagination";
import Breadcrumbs from "../../components/marketplace/Breadcrumbs";
import CartSidebar from "../../components/marketplace/CartSidebar";
import { ShoppingCart, Store } from "lucide-react";
import "../../styles/PremiumPages.css";
import "../../styles/marketplace.css";

export default function MarketplacePage() {
  usePageTitle("Marketplace");
  const {
    products,
    productsLoading,
    productsError,
    totalProducts,
    totalPages,
    currentPage,
    filters,
    setFilters,
    fetchProducts,
    fetchCategories,
    fetchCart,
    cart,
  } = useMarketplaceStore();

  const [cartOpen, setCartOpen] = useState(false);

  // Initial load
  useEffect(() => {
    fetchProducts(1);
    fetchCategories();
    fetchCart();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-apply: re-fetch whenever any filter changes
  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    fetchProducts(1);
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (q) => {
    setFilters({ q });
  };

  const handleApplyFilters = () => {
    fetchProducts(1);
  };

  const handlePageChange = (page) => {
    fetchProducts(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cartCount = cart?.items?.length || 0;

  return (
    <div className="mp-page marketplace-page-premium">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Marketplace" }]} />

      {/* Hero banner */}
      <header className="marketplace-hero-premium">
        <h1 className="marketplace-hero-title-premium">3D Asset Marketplace</h1>
        <p className="marketplace-hero-desc-premium">
          Discover, buy, and sell premium 3D models. {totalProducts} assets available.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "1.5rem", flexWrap: "wrap" }}>
          <div style={{ flex: "1", minWidth: "250px", maxWidth: "400px" }}>
            <SearchBar value={filters.q} onSearch={handleSearch} />
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => setCartOpen(true)}
            aria-label={`Cart (${cartCount} items)`}
            style={{ position: "relative" }}
          >
            <ShoppingCart size={18} />
            Cart {cartCount > 0 && `(${cartCount})`}
            {cartCount > 0 && (
              <span style={{
                position: "absolute",
                top: "-8px",
                right: "-8px",
                background: "#7f5af0",
                color: "white",
                borderRadius: "50%",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: "700"
              }}>
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="marketplace-main-premium">
        {/* Sidebar filters */}
        <div className="marketplace-sidebar-premium">
          <ProductFilters onApply={handleApplyFilters} />
        </div>

        {/* Products grid */}
        <main>
          {productsLoading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "rgba(255,255,255,0.6)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
              <p>Loading premium 3D assets…</p>
            </div>
          ) : productsError ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#ff6b6b" }} role="alert">
              <p>Failed to load products: {productsError}</p>
              <button className="btn btn-secondary" onClick={() => fetchProducts(currentPage)} style={{ marginTop: "1rem" }}>
                Retry
              </button>
            </div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "rgba(255,255,255,0.6)" }}>
              <Store size={48} strokeWidth={1} style={{ marginBottom: "1rem", opacity: 0.5 }} />
              <h2 style={{ margin: "0 0 0.5rem 0" }}>No products found</h2>
              <p style={{ margin: 0 }}>Try adjusting your search or filters.</p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "1.5rem", fontSize: "0.95rem", color: "rgba(255,255,255,0.6)" }}>
                Showing {products.length} of {totalProducts} products
              </div>
              <div className="marketplace-products-grid-premium">
                {products.map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </>
          )}
        </main>
      </div>

      {/* Cart sidebar */}
      <CartSidebar isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
