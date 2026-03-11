// src/pages/ResetPassword.jsx
import React, { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../utils/api";

const API_URL = API_BASE;

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => navigate("/login"), 3000);
      } else {
        setError(data.message || "Reset failed");
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  if (!token) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ color: "#ff6b6b" }}>Invalid Reset Link</h2>
          <Link to="/forgot-password" style={{ color: "#7f5af0" }}>Request a new one</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Inter, system-ui, sans-serif", color: "#fff",
    }}>
      <div style={{
        background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 40,
        border: "1px solid rgba(255,255,255,0.06)", maxWidth: 420, width: "100%",
      }}>
        <h2 style={{ marginBottom: 16 }}>Reset Password</h2>
        {success ? (
          <>
            <p style={{ color: "#2cb67d" }}>Password reset successful! Redirecting to login...</p>
            <Link to="/login" style={{ color: "#7f5af0" }}>Go to Login</Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div style={{ color: "#ff6b6b", marginBottom: 12, fontSize: 13 }}>{error}</div>}
            <input
              type="password" required placeholder="New password (min 8 chars)"
              value={password} onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", marginBottom: 12, boxSizing: "border-box",
              }}
            />
            <input
              type="password" required placeholder="Confirm password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
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
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
