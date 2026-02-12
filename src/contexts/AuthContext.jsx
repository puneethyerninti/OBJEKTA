// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { API_BASE } from "../utils/api";

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};

const STORAGE_USER = "objekta_user";
const STORAGE_TOKEN = "objekta_token";

// ✅ centralized backend base URL
const runtimeApi = typeof window !== "undefined"
  ? (window.__OBJEKTA_API_BASE || window.__OBJEKTA_API_URL__)
  : null;
const API_URL = runtimeApi || API_BASE;

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

  const persist = (u, jwt) => {
    try {
      if (u) localStorage.setItem(STORAGE_USER, JSON.stringify(u));
      else localStorage.removeItem(STORAGE_USER);
      if (jwt) localStorage.setItem(STORAGE_TOKEN, jwt);
      else localStorage.removeItem(STORAGE_TOKEN);
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

      if (res.status === 401 && token) {
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
        persist(data.user, data.token);
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
        persist(data.user, data.token);
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
        persist(data.user, data.token);
        return { ok: true, user: data.user };
      }
      return { ok: false, error: data.message || data.error || "Signup failed" };
    } catch (err) {
      setLoading(false);
      return { ok: false, error: err.message || "Network error" };
    }
  };

  // 🧩 Logout
  const logout = () => {
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
        logout,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
