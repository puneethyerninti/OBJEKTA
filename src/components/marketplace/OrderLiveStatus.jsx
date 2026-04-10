// src/components/marketplace/OrderLiveStatus.jsx
import React, { useEffect, useState } from "react";
import { CheckCircle2, Clock, Truck, Package, XCircle, RefreshCw } from "lucide-react";
import io from "socket.io-client";

const STATUS_STEPS = [
  { key: "pending", label: "Pending", icon: Clock },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "processing", label: "Processing", icon: Package },
  { key: "delivered", label: "Delivered", icon: Truck },
];

const API_BASE =
  typeof window !== "undefined"
    ? window.__OBJEKTA_API_BASE || window.__OBJEKTA_API_URL__ || ""
    : "";

export default function OrderLiveStatus({ order, onStatusUpdate }) {
  const [liveStatus, setLiveStatus] = useState(order?.status || "pending");
  const [livePayment, setLivePayment] = useState(order?.paymentStatus || "pending");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!order?._id) return;

    const socketUrl = API_BASE || window.location.origin;
    const token = localStorage.getItem("objekta_token") || localStorage.getItem("token") || null;
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: token ? { token } : undefined,
    });

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("marketplace:track-order", order._id);
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("order:status:update", (data) => {
      if (data.orderId === order._id) {
        setLiveStatus(data.status);
        setLivePayment(data.paymentStatus);
        onStatusUpdate?.(data);
      }
    });

    return () => {
      socket.emit("marketplace:untrack-order", order._id);
      socket.disconnect();
    };
  }, [order?._id]);

  // Update when order prop changes
  useEffect(() => {
    if (order?.status) setLiveStatus(order.status);
    if (order?.paymentStatus) setLivePayment(order.paymentStatus);
  }, [order?.status, order?.paymentStatus]);

  const isCancelled = liveStatus === "cancelled" || liveStatus === "refunded";
  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === liveStatus);

  return (
    <div className="mp-order-live-status">
      <div className="mp-live-indicator">
        <span className={`mp-live-dot ${connected ? "mp-live-connected" : ""}`} />
        <span className="mp-live-label">{connected ? "Live Tracking" : "Connecting..."}</span>
      </div>

      {isCancelled ? (
        <div className="mp-status-cancelled">
          <XCircle size={32} />
          <span>{liveStatus === "refunded" ? "Order Refunded" : "Order Cancelled"}</span>
        </div>
      ) : (
        <div className="mp-status-tracker">
          {STATUS_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i <= currentIndex;
            const isCurrent = step.key === liveStatus;
            return (
              <div
                key={step.key}
                className={`mp-status-step ${isActive ? "mp-step-active" : ""} ${isCurrent ? "mp-step-current" : ""}`}
              >
                <div className="mp-step-icon">
                  <Icon size={20} />
                </div>
                <span className="mp-step-label">{step.label}</span>
                {i < STATUS_STEPS.length - 1 && <div className={`mp-step-line ${isActive ? "mp-line-active" : ""}`} />}
              </div>
            );
          })}
        </div>
      )}

      <div className="mp-payment-status">
        Payment: <span className={`mp-payment-badge mp-payment-${livePayment}`}>{livePayment}</span>
      </div>
    </div>
  );
}
