// src/components/marketplace/Breadcrumbs.jsx
import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export default function Breadcrumbs({ items = [] }) {
  return (
    <nav className="mp-breadcrumbs" aria-label="Breadcrumb">
      <ol style={{ display: "flex", alignItems: "center", gap: 6, listStyle: "none", padding: 0, margin: 0, fontSize: "0.85rem" }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {i > 0 && <ChevronRight size={14} style={{ color: "#666" }} />}
            {item.to ? (
              <Link to={item.to} className="mp-breadcrumb-link">{item.label}</Link>
            ) : (
              <span style={{ color: "#9da6d4" }}>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
