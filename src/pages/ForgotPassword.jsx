// src/pages/ForgotPassword.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";
import { API_BASE } from "../utils/api";
import "../styles/PremiumPages.css";

const API_URL = API_BASE;

export default function ForgotPassword() {
  usePageTitle("Forgot Password");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
      } else {
        setError(data.message || "Failed to send reset email");
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Inter, system-ui, sans-serif", color: "#fff",
    }}>
      <div style={{
        background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 40,
        border: "1px solid rgba(255,255,255,0.06)", maxWidth: 420, width: "100%",
      }}>
        <h2 style={{ marginBottom: 8 }}>Forgot Password</h2>
        {sent ? (
          <>
            <p style={{ color: "#2cb67d", marginBottom: 16 }}>
              If that email exists, a reset link has been sent. Check your inbox.
            </p>
            <Link to="/login" style={{ color: "#7f5af0" }}>Back to Login</Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: 20, fontSize: 14 }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
            {error && <div style={{ color: "#ff6b6b", marginBottom: 12, fontSize: 13 }}>{error}</div>}
            <input
              type="email" required placeholder="Email address" value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", marginBottom: 16, boxSizing: "border-box",
              }}
            />
            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "10px 0", background: "#7f5af0", color: "#fff",
              border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer",
            }}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <Link to="/login" style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Back to Login</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
