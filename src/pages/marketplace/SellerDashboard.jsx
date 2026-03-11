// src/pages/marketplace/SellerDashboard.jsx
import React, { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useMarketplaceStore } from "../../store/MarketplaceStore";
import Breadcrumbs from "../../components/marketplace/Breadcrumbs";
import {
  BarChart3,
  Package,
  DollarSign,
  TrendingUp,
  Plus,
  Edit,
  Trash2,
  ShoppingBag,
  X,
} from "lucide-react";
import "../../styles/marketplace.css";

const CATEGORIES = [
  "characters","vehicles","architecture","furniture","nature","weapons","props","environments","animations","other",
];

export default function SellerDashboard() {
  const { user } = useAuth();
  const {
    sellerProducts,
    sellerStats,
    sellerOrders,
    sellerLoading,
    fetchSellerProducts,
    fetchSellerStats,
    fetchSellerOrders,
    createProduct,
    deleteProduct,
  } = useMarketplaceStore();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "other",
    tags: "",
    format: "glb",
    polyCount: "",
    textured: false,
    rigged: false,
    animated: false,
    license: "standard",
  });
  const [assetFile, setAssetFile] = useState(null);
  const [thumbFile, setThumbFile] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    fetchSellerProducts();
    fetchSellerStats();
    fetchSellerOrders();
  }, []);

  if (!user) return <Navigate to="/login" replace />;

  const formatPrice = (p) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(p || 0);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.price) {
      setCreateError("Title and price are required");
      return;
    }
    setCreating(true);
    setCreateError("");

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (assetFile) fd.append("asset", assetFile);
    if (thumbFile) fd.append("thumbnail", thumbFile);

    const res = await createProduct(fd);
    setCreating(false);
    if (res.ok) {
      setShowCreate(false);
      setForm({ title: "", description: "", price: "", category: "other", tags: "", format: "glb", polyCount: "", textured: false, rigged: false, animated: false, license: "standard" });
      setAssetFile(null);
      setThumbFile(null);
    } else {
      setCreateError(res.error || "Failed to create product");
    }
  };

  const stats = sellerStats || {};

  return (
    <div className="mp-page">
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Marketplace", to: "/marketplace" },
          { label: "Seller Dashboard" },
        ]}
      />

      <h1 className="mp-page-title">
        <BarChart3 size={28} /> Seller Dashboard
      </h1>

      {/* Stats Cards */}
      <div className="mp-stats-grid">
        <div className="mp-stat-card">
          <Package size={24} />
          <div className="mp-stat-value">{stats.totalProducts ?? 0}</div>
          <div className="mp-stat-label">Products</div>
        </div>
        <div className="mp-stat-card">
          <ShoppingBag size={24} />
          <div className="mp-stat-value">{stats.totalSold ?? 0}</div>
          <div className="mp-stat-label">Units Sold</div>
        </div>
        <div className="mp-stat-card">
          <DollarSign size={24} />
          <div className="mp-stat-value">{formatPrice(stats.grossRevenue)}</div>
          <div className="mp-stat-label">Gross Revenue</div>
        </div>
        <div className="mp-stat-card">
          <TrendingUp size={24} />
          <div className="mp-stat-value">{formatPrice(stats.netRevenue)}</div>
          <div className="mp-stat-label">Net Revenue ({100 - (stats.platformFeePercent || 10)}%)</div>
        </div>
      </div>

      {/* Products Management */}
      <section className="mp-seller-section">
        <div className="mp-section-header">
          <h2>Your Products</h2>
          <button className="mp-btn mp-btn-primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? <><X size={16} /> Cancel</> : <><Plus size={16} /> New Product</>}
          </button>
        </div>

        {/* Create Product Form */}
        {showCreate && (
          <form className="mp-create-form" onSubmit={handleCreateSubmit}>
            <div className="mp-form-grid">
              <div className="mp-form-field">
                <label>Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="mp-form-field">
                <label>Price (USD) *</label>
                <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              </div>
              <div className="mp-form-field">
                <label>Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="mp-form-field">
                <label>Format</label>
                <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
                  <option value="glb">GLB</option>
                  <option value="gltf">glTF</option>
                  <option value="fbx">FBX</option>
                  <option value="obj">OBJ</option>
                  <option value="usdz">USDZ</option>
                </select>
              </div>
              <div className="mp-form-field mp-form-full">
                <label>Description</label>
                <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="mp-form-field">
                <label>Tags (comma-separated)</label>
                <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="e.g. sci-fi, animated, game-ready" />
              </div>
              <div className="mp-form-field">
                <label>Poly Count</label>
                <input type="number" min="0" value={form.polyCount} onChange={(e) => setForm({ ...form, polyCount: e.target.value })} />
              </div>
              <div className="mp-form-field">
                <label>License</label>
                <select value={form.license} onChange={(e) => setForm({ ...form, license: e.target.value })}>
                  <option value="standard">Standard</option>
                  <option value="extended">Extended</option>
                  <option value="exclusive">Exclusive</option>
                </select>
              </div>
              <div className="mp-form-field mp-form-checkboxes">
                <label><input type="checkbox" checked={form.textured} onChange={(e) => setForm({ ...form, textured: e.target.checked })} /> Textured</label>
                <label><input type="checkbox" checked={form.rigged} onChange={(e) => setForm({ ...form, rigged: e.target.checked })} /> Rigged</label>
                <label><input type="checkbox" checked={form.animated} onChange={(e) => setForm({ ...form, animated: e.target.checked })} /> Animated</label>
              </div>
              <div className="mp-form-field">
                <label>3D Asset File</label>
                <input type="file" accept=".glb,.gltf,.fbx,.obj,.usdz,.zip" onChange={(e) => setAssetFile(e.target.files[0])} />
              </div>
              <div className="mp-form-field">
                <label>Thumbnail Image</label>
                <input type="file" accept="image/*" onChange={(e) => setThumbFile(e.target.files[0])} />
              </div>
            </div>
            {createError && <p className="mp-form-error">{createError}</p>}
            <button className="mp-btn mp-btn-primary" type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create Product"}
            </button>
          </form>
        )}

        {/* Products List */}
        {sellerLoading ? (
          <div className="mp-loading"><div className="mp-spinner" /><p>Loading…</p></div>
        ) : sellerProducts.length === 0 ? (
          <p className="mp-empty-text">You haven't listed any products yet.</p>
        ) : (
          <div className="mp-seller-products">
            {sellerProducts.map((p) => (
              <div key={p._id} className="mp-seller-product-row">
                <div className="mp-seller-product-info">
                  {p.thumbnail ? (
                    <img src={p.thumbnail} alt={p.title} className="mp-seller-product-img" />
                  ) : (
                    <div className="mp-seller-product-placeholder" />
                  )}
                  <div>
                    <Link to={`/marketplace/product/${p.slug || p._id}`} className="mp-seller-product-title">
                      {p.title}
                    </Link>
                    <span className={`mp-status-badge mp-status-${p.status}`}>{p.status}</span>
                  </div>
                </div>
                <span>{formatPrice(p.price)}</span>
                <span>{p.sold || 0} sold</span>
                <div className="mp-seller-product-actions">
                  <button className="mp-btn-icon" title="Delete" onClick={() => deleteProduct(p._id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Orders */}
      <section className="mp-seller-section">
        <h2>Recent Orders</h2>
        {sellerOrders.length === 0 ? (
          <p className="mp-empty-text">No orders yet.</p>
        ) : (
          <div className="mp-seller-orders">
            {sellerOrders.map((order) => (
              <div key={order._id} className="mp-seller-order-row">
                <span className="mp-order-id">#{order._id.slice(-8)}</span>
                <span>{order.buyer?.name || order.buyer?.email || "Buyer"}</span>
                <span className={`mp-status-badge mp-status-${order.status}`}>{order.status}</span>
                <span>{formatPrice(order.total)}</span>
                <time>{new Date(order.createdAt).toLocaleDateString()}</time>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
