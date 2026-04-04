// src/pages/Admin.jsx
import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";

const ROLES = ["buyer", "seller", "admin"];

function StatCard({ label, value, color = "#7f5af0" }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "18px 22px",
      border: "1px solid rgba(255,255,255,0.06)", minWidth: 140,
    }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value ?? "—"}</div>
    </div>
  );
}

export default function Admin() {
  usePageTitle("Admin");
  const { user, authFetch } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect non-admin
  useEffect(() => {
    if (user && user.role !== "admin") navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const fetchStats = useCallback(async () => {
    const r = await authFetch("/api/auth/admin/stats");
    if (r.ok) setStats(r.data);
  }, [authFetch]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 20 });
    if (search) params.set("search", search);
    if (roleFilter) params.set("role", roleFilter);
    const r = await authFetch(`/api/auth/admin/users?${params}`);
    if (r.ok) {
      setUsers(r.data.users || []);
      setTotalPages(r.data.totalPages || 1);
    }
    setLoading(false);
  }, [authFetch, page, search, roleFilter]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSetRole = async (userId, role) => {
    await authFetch(`/api/auth/admin/users/${userId}/role`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    fetchUsers();
    fetchStats();
  };

  const handleSuspend = async (userId, suspended) => {
    await authFetch(`/api/auth/admin/users/${userId}/suspend`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended, reason: suspended ? "Suspended by admin" : "" }),
    });
    fetchUsers();
    fetchStats();
  };

  if (!user || user.role !== "admin") return null;

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a12", color: "#fff",
      padding: "32px 24px", fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700 }}>Admin Dashboard</h1>
          <button onClick={() => navigate("/dashboard")}
            style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>
            Back to Dashboard
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
            <StatCard label="Total Users" value={stats.totalUsers} />
            <StatCard label="Buyers" value={stats.roles?.buyer || 0} color="#2cb67d" />
            <StatCard label="Sellers" value={stats.roles?.seller || 0} color="#3ab4ff" />
            <StatCard label="Admins" value={stats.roles?.admin || 0} color="#ff6b6b" />
            <StatCard label="New (7 days)" value={stats.newUsersLast7Days} color="#ffd166" />
            <StatCard label="Suspended" value={stats.suspendedCount} color="#ff6b6b" />
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <input
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff", padding: "8px 14px", borderRadius: 8, minWidth: 240,
            }}
          />
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff", padding: "8px 14px", borderRadius: 8,
            }}
          >
            <option value="">All Roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
        </div>

        {/* User Table */}
        <div style={{
          background: "rgba(255,255,255,0.02)", borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                {["Name", "Email", "Role", "Verified", "2FA", "Status", "Joined", "Actions"].map((h) => (
                  <th key={h} style={{
                    padding: "12px 14px", textAlign: "left", fontSize: 12,
                    color: "rgba(255,255,255,0.5)", fontWeight: 600, textTransform: "uppercase",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.4)" }}>Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.4)" }}>No users found</td></tr>
              ) : users.map((u) => (
                <tr key={u._id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{u.name}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{u.email}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <select value={u.role} onChange={(e) => handleSetRole(u._id, e.target.value)}
                      disabled={u._id === user.id}
                      style={{
                        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "#fff", padding: "4px 8px", borderRadius: 6, fontSize: 12,
                      }}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ color: u.emailVerified ? "#2cb67d" : "#ff6b6b" }}>
                      {u.emailVerified ? "Yes" : "No"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ color: u.twoFactorEnabled ? "#2cb67d" : "rgba(255,255,255,0.3)" }}>
                      {u.twoFactorEnabled ? "On" : "Off"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: u.suspended ? "rgba(255,107,107,0.15)" : "rgba(44,182,125,0.15)",
                      color: u.suspended ? "#ff6b6b" : "#2cb67d",
                    }}>{u.suspended ? "Suspended" : "Active"}</span>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {u._id !== user.id && (
                      <button
                        onClick={() => handleSuspend(u._id, !u.suspended)}
                        style={{
                          background: u.suspended ? "rgba(44,182,125,0.15)" : "rgba(255,107,107,0.15)",
                          color: u.suspended ? "#2cb67d" : "#ff6b6b",
                          border: "none", padding: "4px 12px", borderRadius: 6,
                          fontSize: 11, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        {u.suspended ? "Unsuspend" : "Suspend"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
              style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#fff", padding: "6px 14px", borderRadius: 6, cursor: "pointer" }}>
              Prev
            </button>
            <span style={{ padding: "6px 14px", color: "rgba(255,255,255,0.5)" }}>
              {page} / {totalPages}
            </span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
              style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#fff", padding: "6px 14px", borderRadius: 6, cursor: "pointer" }}>
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
