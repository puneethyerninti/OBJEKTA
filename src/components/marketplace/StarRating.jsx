// src/components/marketplace/StarRating.jsx
import React from "react";
import { Star } from "lucide-react";

export default function StarRating({ rating = 0, max = 5, size = 16, interactive = false, onChange }) {
  const stars = [];
  for (let i = 1; i <= max; i++) {
    const filled = i <= Math.round(rating);
    stars.push(
      <Star
        key={i}
        size={size}
        fill={filled ? "#ffb800" : "transparent"}
        stroke={filled ? "#ffb800" : "#555"}
        style={{ cursor: interactive ? "pointer" : "default", transition: "fill 0.15s" }}
        onClick={() => interactive && onChange?.(i)}
        aria-label={`${i} star${i > 1 ? "s" : ""}`}
      />
    );
  }
  return (
    <span className="mp-star-rating" style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
      {stars}
    </span>
  );
}
