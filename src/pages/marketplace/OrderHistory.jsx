// src/pages/marketplace/OrderHistory.jsx
import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMarketplaceStore } from "../../store/MarketplaceStore";
import { useAuth } from "../../contexts/AuthContext";
import Breadcrumbs from "../../components/marketplace/Breadcrumbs";
import { Package, Clock, CheckCircle2, XCircle, ChevronRight, Download, RefreshCw } from "lucide-react";
import "../../styles/marketplace.css";

const STATUS_ICON = {
  pending: <Clock size={16} />,
  confirmed: <CheckCircle2 size={16} />,
  processing: <Package size={16} />,
  delivered: <CheckCircle2 size={16} />,
  cancelled: <XCircle size={16} />,
  refunded: <XCircle size={16} />,
};

export default function OrderHistory() {
  const { user, authFetch } = useAuth();
  const { orders, ordersLoading, fetchOrders } = useMarketplaceStore();
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [refreshing, setRefreshing] = useState({});

  useEffect(() => {
    fetchOrders();
  }, []);

  if (!user) return <Navigate to="/login" replace />;

  const formatPrice = (p) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(p);

  const handleRefreshDownload = async (orderId, productId) => {
    const key = `${orderId}_${productId}`;
    setRefreshing((prev) => ({ ...prev, [key]: true }));
    try {
      const r = await authFetch(`/api/marketplace/downloads/refresh/${orderId}/${productId}`, { method: "POST" });
      if (r.ok) fetchOrders(); // refresh order data
    } catch {}
    setRefreshing((prev) => ({ ...prev, [key]: false }));
  };

  return (
    <div className="mp-page">
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Marketplace", to: "/marketplace" },
          { label: "Orders" },
        ]}
      />

      <h1 className="mp-page-title">
        <Package size={28} /> Order History
      </h1>

      {ordersLoading ? (
        <div className="mp-loading">
          <div className="mp-spinner" />
          <p>Loading orders…</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="mp-empty">
          <Package size={64} strokeWidth={1} />
          <h2>No orders yet</h2>
          <Link to="/marketplace" className="mp-btn mp-btn-primary">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="mp-orders-list">
          {orders.map((order) => (
            <div key={order._id} className="mp-order-card" style={{ cursor: "default" }}>
              <Link to={`/marketplace/orders/${order._id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="mp-order-card-header">
                  <span className="mp-order-id">Order #{order._id.slice(-8)}</span>
                  <span className="mp-order-date">
                    {new Date(order.createdAt).toLocaleDateString("en-US", {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </span>
                </div>
                <div className="mp-order-card-body">
                  <div className="mp-order-items-preview">
                    {order.items.slice(0, 3).map((item, i) => (
                      <span key={i} className="mp-order-item-mini">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt="" className="mp-order-mini-img" />
                        ) : (
                          <div className="mp-order-mini-placeholder" />
                        )}
                      </span>
                    ))}
                    {order.items.length > 3 && (
                      <span className="mp-order-more">+{order.items.length - 3} more</span>
                    )}
                  </div>
                  <div className="mp-order-card-info">
                    <span className={`mp-status-badge mp-status-${order.status}`}>
                      {STATUS_ICON[order.status]} {order.status}
                    </span>
                    <span className="mp-order-total">{formatPrice(order.total)}</span>
                  </div>
                </div>
              </Link>

              {/* Download Manager */}
              {order.paymentStatus === "succeeded" && order.downloadLinks?.length > 0 && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 0 4px", marginTop: 8 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedOrder(expandedOrder === order._id ? null : order._id); }}
                    style={{
                      background: "none", border: "none", color: "#7f5af0", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, padding: 0,
                    }}
                  >
                    <Download size={14} /> Downloads ({order.downloadLinks.length})
                    <ChevronRight size={14} style={{ transform: expandedOrder === order._id ? "rotate(90deg)" : "none", transition: "0.2s" }} />
                  </button>
                  {expandedOrder === order._id && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                      {order.downloadLinks.map((dl, i) => {
                        const item = order.items.find((it) => it.product === dl.product || it.product?._id === dl.product);
                        const expired = dl.signedUrlExpires && new Date() > new Date(dl.signedUrlExpires);
                        const limitReached = dl.downloadCount >= dl.maxDownloads;
                        const key = `${order._id}_${dl.product}`;
                        return (
                          <div key={i} style={{
                            display: "flex", alignItems: "center", gap: 12, padding: "8px 12px",
                            background: "rgba(255,255,255,0.03)", borderRadius: 8,
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{item?.title || "Asset"}</div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                                {dl.downloadCount}/{dl.maxDownloads} downloads
                                {dl.license && ` · ${dl.license} license`}
                              </div>
                            </div>
                            {limitReached ? (
                              <span style={{ fontSize: 11, color: "#ff6b6b" }}>Limit reached</span>
                            ) : expired ? (
                              <button
                                onClick={() => handleRefreshDownload(order._id, dl.product)}
                                disabled={refreshing[key]}
                                style={{
                                  background: "rgba(127,90,240,0.15)", border: "none", color: "#7f5af0",
                                  padding: "4px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                                  display: "flex", alignItems: "center", gap: 4,
                                }}
                              >
                                <RefreshCw size={12} /> {refreshing[key] ? "..." : "Refresh"}
                              </button>
                            ) : (
                              <a
                                href={dl.signedUrl || dl.url}
                                target="_blank" rel="noopener noreferrer"
                                style={{
                                  background: "#7f5af0", color: "#fff", padding: "4px 14px",
                                  borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: "none",
                                  display: "flex", alignItems: "center", gap: 4,
                                }}
                              >
                                <Download size={12} /> Download
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
