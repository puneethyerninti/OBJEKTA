// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { API_BASE } from "../utils/api";

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};

const STORAGE_USER = "objekta_user";
const STORAGE_TOKEN = "objekta_token";
const STORAGE_TOKEN_EXPIRY = "objekta_token_expiry";

// ✅ centralized backend base URL
const runtimeApi = typeof window !== "undefined"
  ? (window.__OBJEKTA_API_BASE || window.__OBJEKTA_API_URL__)
  : null;
const API_URL = runtimeApi || API_BASE;

// Decode JWT to get expiration time
const decodeJWT = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.warn('[OBJEKTA] JWT decode failed', err);
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_USER) || "null");
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_TOKEN) || null);
  const [loading, setLoading] = useState(false);
  const refreshTimerRef = useRef(null);
  const isRefreshing = useRef(false);

  // keep user & token synced across tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_USER) {
        try {
          setUser(JSON.parse(e.newValue || "null"));
        } catch {
          setUser(null);
        }
      }
      if (e.key === STORAGE_TOKEN) {
        setToken(e.newValue || null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = (u, jwt, expiryMs) => {
    try {
      if (u) localStorage.setItem(STORAGE_USER, JSON.stringify(u));
      else localStorage.removeItem(STORAGE_USER);
      if (jwt) {
        localStorage.setItem(STORAGE_TOKEN, jwt);
        // Store token expiry time for proactive refresh
        if (expiryMs) localStorage.setItem(STORAGE_TOKEN_EXPIRY, expiryMs.toString());
      } else {
        localStorage.removeItem(STORAGE_TOKEN);
        localStorage.removeItem(STORAGE_TOKEN_EXPIRY);
      }
    } catch {}
    setUser(u);
    setToken(jwt || null);
  };

  // 🔒 parse JSON safely and return useful info
  const parseRes = async (res) => {
    const text = await res.text();
    if (!text) return { ok: res.ok, status: res.status };
    try {
      const json = JSON.parse(text);
      return { ...json, ok: res.ok, status: res.status };
    } catch {
      return { raw: text, ok: res.ok, status: res.status };
    }
  };

  const notifySessionExpired = (detail = null) => {
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("objekta:session-expired", { detail }));
      }
    } catch (e) {}
  };

  // ✅ Token refresh helper
  const refreshAccessToken = async () => {
    if (isRefreshing.current) return null; // Prevent concurrent refresh
    isRefreshing.current = true;
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return null;
      const data = await parseRes(res);
      if (data.token) {
        // Calculate expiry time
        const decoded = decodeJWT(data.token);
        const expiryMs = decoded?.exp ? decoded.exp * 1000 : null;
        persist(data.user || user, data.token, expiryMs);
        scheduleTokenRefresh(expiryMs);
        return data.token;
      }
      return null;
    } catch {
      return null;
    } finally {
      isRefreshing.current = false;
    }
  };

  // 🔄 Schedule proactive token refresh (before expiry)
  const scheduleTokenRefresh = (expiryMs) => {
    // Clear existing timer
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    if (!expiryMs) return;

    // Refresh 30 seconds before expiry (or 5 minutes, whichever is sooner)
    const now = Date.now();
    const timeUntilExpiry = expiryMs - now;
    const refreshIn = Math.max(1000, Math.min(timeUntilExpiry - 30000, 5 * 60 * 1000));

    refreshTimerRef.current = setTimeout(() => {
      console.debug('[OBJEKTA] Proactive token refresh');
      refreshAccessToken();
    }, refreshIn);
  };

  // Setup refresh schedule on mount and token change
  useEffect(() => {
    if (!token) return;
    const decoded = decodeJWT(token);
    if (decoded?.exp) {
      scheduleTokenRefresh(decoded.exp * 1000);
    }
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [token]);

  // ✅ improved fetch helper: safe for absolute or relative URLs
  const authFetch = async (url, options = {}) => {
    try {
      const headers = { ...(options.headers || {}) };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const fullUrl = /^https?:\/\//i.test(url)
        ? url
        : `${API_URL.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;

      const res = await fetch(fullUrl, { ...options, headers, credentials: options.credentials || "include" });
      const data = await parseRes(res);

      // Auto-refresh on 401 (expired access token)
      if (res.status === 401 && token && !url.includes("/auth/refresh")) {
        const refreshResult = await refreshAccessToken();
        if (refreshResult) {
          // Retry original request with new token
          headers["Authorization"] = `Bearer ${refreshResult}`;
          const retryRes = await fetch(fullUrl, { ...options, headers, credentials: options.credentials || "include" });
          const retryData = await parseRes(retryRes);
          return { ok: retryRes.ok, status: retryRes.status, data: retryData, res: retryRes };
        }
        console.warn("[OBJEKTA] authFetch detected 401, clearing session", fullUrl);
        persist(null, null);
        notifySessionExpired({ url: fullUrl, status: res.status });
      }

      return { ok: res.ok, status: res.status, data, res };
    } catch (err) {
      if (err?.name === 'AbortError') {
        console.debug('[OBJEKTA] authFetch aborted (ignored)');
        return { ok: false, status: 0, data: null, aborted: true };
      }
      console.warn('[OBJEKTA] authFetch network error', err);
      return { ok: false, status: 0, data: null, error: err };
    }
  };

  // 🧩 Login
  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await parseRes(res);
      setLoading(false);

      if (res.ok && data.token) {
        const decoded = decodeJWT(data.token);
        const expiryMs = decoded?.exp ? decoded.exp * 1000 : null;
        persist(data.user, data.token, expiryMs);
        scheduleTokenRefresh(expiryMs);
        return { ok: true, user: data.user };
      }
      return { ok: false, error: data.message || data.error || "Login failed" };
    } catch (err) {
      setLoading(false);
      return { ok: false, error: err.message || "Network error" };
    }
  };

  // 🧩 OAuth (frontend receives provider id token and exchanges for app JWT)
  const authWithProvider = async (provider, idToken) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/oauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, id_token: idToken }),
      });
      const data = await parseRes(res);
      setLoading(false);
      if (res.ok && data.token) {
        const decoded = decodeJWT(data.token);
        const expiryMs = decoded?.exp ? decoded.exp * 1000 : null;
        persist(data.user, data.token, expiryMs);
        scheduleTokenRefresh(expiryMs);
        return { ok: true, user: data.user };
      }
      return { ok: false, error: data.message || data.error || 'OAuth login failed' };
    } catch (err) {
      setLoading(false);
      return { ok: false, error: err.message || 'Network error' };
    }
  };

  // 🧩 Signup
  const signup = async (name, email, password) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await parseRes(res);
      setLoading(false);

      if (res.ok && data.token) {
        const decoded = decodeJWT(data.token);
        const expiryMs = decoded?.exp ? decoded.exp * 1000 : null;
        persist(data.user, data.token, expiryMs);
        scheduleTokenRefresh(expiryMs);
        return { ok: true, user: data.user };
      }
      return { ok: false, error: data.message || data.error || "Signup failed" };
    } catch (err) {
      setLoading(false);
      return { ok: false, error: err.message || "Network error" };
    }
  };

  // 🧩 OTP Login (passwordless)
  const requestOTP = async (email) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/login/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await parseRes(res);
      return { ok: res.ok, data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  const verifyOTP = async (email, otp) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await parseRes(res);
      setLoading(false);

      if (res.ok && data.token) {
        const decoded = decodeJWT(data.token);
        const expiryMs = decoded?.exp ? decoded.exp * 1000 : null;
        persist(data.user, data.token, expiryMs);
        scheduleTokenRefresh(expiryMs);
        return { ok: true, user: data.user };
      }
      return { ok: false, error: data.message || data.error || "OTP verification failed" };
    } catch (err) {
      setLoading(false);
      return { ok: false, error: err.message || "Network error" };
    }
  };

  // 🧩 Logout
  const logout = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    persist(null, null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        authWithProvider,
        signup,
        requestOTP,
        verifyOTP,
        logout,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
