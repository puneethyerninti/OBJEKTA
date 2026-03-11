// src/pages/marketplace/MarketplacePage.jsx
import React, { useEffect, useState } from "react";
import { useMarketplaceStore } from "../../store/MarketplaceStore";
import ProductCard from "../../components/marketplace/ProductCard";
import ProductFilters from "../../components/marketplace/ProductFilters";
import SearchBar from "../../components/marketplace/SearchBar";
import Pagination from "../../components/marketplace/Pagination";
import Breadcrumbs from "../../components/marketplace/Breadcrumbs";
import CartSidebar from "../../components/marketplace/CartSidebar";
import { ShoppingCart, Store } from "lucide-react";
import "../../styles/marketplace.css";

export default function MarketplacePage() {
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
    <div className="mp-page">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Marketplace" }]} />

      {/* Hero banner */}
      <header className="mp-hero">
        <div className="mp-hero-content">
          <Store size={36} />
          <h1 className="mp-hero-title">3D Asset Marketplace</h1>
          <p className="mp-hero-subtitle">
            Discover, buy, and sell premium 3D models. {totalProducts} assets available.
          </p>
        </div>
        <div className="mp-hero-actions">
          <SearchBar value={filters.q} onSearch={handleSearch} />
          <button
            className="mp-btn mp-btn-cart"
            onClick={() => setCartOpen(true)}
            aria-label={`Cart (${cartCount} items)`}
          >
            <ShoppingCart size={20} />
            {cartCount > 0 && <span className="mp-cart-badge">{cartCount}</span>}
          </button>
        </div>
      </header>

      <div className="mp-layout">
        {/* Sidebar filters */}
        <ProductFilters onApply={handleApplyFilters} />

        {/* Products grid */}
        <main className="mp-main">
          {productsLoading ? (
            <div className="mp-loading">
              <div className="mp-spinner" />
              <p>Loading products…</p>
            </div>
          ) : productsError ? (
            <div className="mp-error" role="alert">
              <p>Failed to load products: {productsError}</p>
              <button className="mp-btn mp-btn-primary" onClick={() => fetchProducts(currentPage)}>
                Retry
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="mp-empty">
              <Store size={48} strokeWidth={1} />
              <h2>No products found</h2>
              <p>Try adjusting your search or filters.</p>
            </div>
          ) : (
            <>
              <div className="mp-results-info">
                <span>
                  Showing {products.length} of {totalProducts} products
                </span>
              </div>
              <div className="mp-product-grid">
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
