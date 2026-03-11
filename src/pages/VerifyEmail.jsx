// src/pages/VerifyEmail.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { API_BASE } from "../utils/api";

const API_URL = API_BASE;

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setMessage("No verification token found."); return; }

    fetch(`${API_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.message?.includes("verified")) {
          setStatus("success");
          setMessage(data.message);
        } else {
          setStatus("error");
          setMessage(data.message || "Verification failed");
        }
      })
      .catch(() => { setStatus("error"); setMessage("Network error"); });
  }, [token]);

  return (
    <div style={{
      minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Inter, system-ui, sans-serif", color: "#fff",
    }}>
      <div style={{
        background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 40,
        border: "1px solid rgba(255,255,255,0.06)", textAlign: "center", maxWidth: 440,
      }}>
        {status === "verifying" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h2>Verifying your email...</h2>
          </>
        )}
        {status === "success" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ color: "#2cb67d" }}>Email Verified!</h2>
            <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: 24 }}>{message}</p>
            <Link to="/login" style={{
              display: "inline-block", padding: "10px 24px", background: "#7f5af0",
              color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 600,
            }}>Go to Login</Link>
          </>
        )}
        {status === "error" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={{ color: "#ff6b6b" }}>Verification Failed</h2>
            <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: 24 }}>{message}</p>
            <Link to="/login" style={{
              display: "inline-block", padding: "10px 24px", background: "rgba(255,255,255,0.08)",
              color: "#fff", borderRadius: 8, textDecoration: "none",
            }}>Back to Login</Link>
          </>
        )}
      </div>
    </div>
  );
}
