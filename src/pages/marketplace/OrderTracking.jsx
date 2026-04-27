// src/pages/marketplace/OrderTracking.jsx
import React, { useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useMarketplaceStore } from "../../store/MarketplaceStore";
import { useAuth } from "../../contexts/AuthContext";
import Breadcrumbs from "../../components/marketplace/Breadcrumbs";
import OrderLiveStatus from "../../components/marketplace/OrderLiveStatus";
import { Package, Download, ArrowLeft } from "lucide-react";
import "../../styles/marketplace.css";

export default function OrderTracking() {
  usePageTitle("Order Tracking");
  const { orderId } = useParams();
  const { user } = useAuth();
  const { currentOrder, fetchOrderDetail, ordersLoading } = useMarketplaceStore();

  useEffect(() => {
    if (orderId) fetchOrderDetail(orderId);
  }, [orderId, fetchOrderDetail]);

  if (!user) return <Navigate to="/login" replace />;

  const formatPrice = (p) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(p);

  if (ordersLoading || !currentOrder) {
    return (
      <div className="mp-page">
        <div className="mp-loading">
          <div className="mp-spinner" />
          <p>Loading order…</p>
        </div>
      </div>
    );
  }

  const order = currentOrder;

  return (
    <div className="mp-page">
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Marketplace", to: "/marketplace" },
          { label: "Orders", to: "/marketplace/orders" },
          { label: `#${order._id.slice(-8)}` },
        ]}
      />

      <div className="mp-order-detail">
        <div className="mp-order-detail-header">
          <Link to="/marketplace/orders" className="mp-back-link">
            <ArrowLeft size={18} /> Back to Orders
          </Link>
          <h1 className="mp-page-title">
            <Package size={28} /> Order #{order._id.slice(-8)}
          </h1>
          <time className="mp-order-date-full">
            {new Date(order.createdAt).toLocaleString("en-US", {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </time>
        </div>

        {/* Live Status Tracker */}
        <OrderLiveStatus order={order} />

        {/* Items */}
        <section className="mp-order-items-section">
          <h3>Items</h3>
          <div className="mp-order-items-list">
            {order.items.map((item, i) => (
              <div key={i} className="mp-order-item-row">
                <div className="mp-order-item-left">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.title} className="mp-order-item-img" />
                  ) : (
                    <div className="mp-order-item-placeholder" />
                  )}
                  <div>
                    <span className="mp-order-item-title">{item.title}</span>
                    <span className="mp-order-item-qty">Qty: {item.quantity}</span>
                  </div>
                </div>
                <span className="mp-order-item-price">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Download Links */}
        {order.downloadLinks?.length > 0 && order.paymentStatus === "succeeded" && (
          <section className="mp-order-downloads">
            <h3>
              <Download size={20} /> Downloads
            </h3>
            <div className="mp-download-list">
              {order.downloadLinks.map((dl, i) => (
                <a
                  key={i}
                  href={dl.signedUrl || dl.url}
                  className="mp-btn mp-btn-ghost"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download size={16} /> Download Asset {i + 1}
                </a>
              ))}
            </div>
            <p className="mp-download-note">
              Download links expire on{" "}
              {new Date(order.downloadLinks[0].expiresAt).toLocaleDateString("en-US", {
                dateStyle: "long",
              })}
            </p>
          </section>
        )}

        {/* Order Summary */}
        <section className="mp-order-summary-section">
          <h3>Summary</h3>
          <div className="mp-order-summary-rows">
            <div className="mp-summary-row">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            <div className="mp-summary-row">
              <span>Platform Fee</span>
              <span>{formatPrice(order.platformFee)}</span>
            </div>
            <div className="mp-summary-row mp-summary-total">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </section>

        {/* Status History */}
        {order.statusHistory?.length > 0 && (
          <section className="mp-order-history-section">
            <h3>Status History</h3>
            <ul className="mp-status-history">
              {order.statusHistory.map((h, i) => (
                <li key={i} className="mp-status-history-item">
                  <span className={`mp-status-badge mp-status-${h.status}`}>{h.status}</span>
                  <span className="mp-status-history-note">{h.note}</span>
                  <time>
                    {new Date(h.timestamp).toLocaleString("en-US", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </time>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
