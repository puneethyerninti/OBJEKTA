// src/components/marketplace/ProductFilters.jsx
import React from "react";
import { useMarketplaceStore } from "../../store/MarketplaceStore";
import { SlidersHorizontal } from "lucide-react";

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "characters", label: "Characters" },
  { value: "vehicles", label: "Vehicles" },
  { value: "architecture", label: "Architecture" },
  { value: "furniture", label: "Furniture" },
  { value: "nature", label: "Nature" },
  { value: "weapons", label: "Weapons" },
  { value: "props", label: "Props" },
  { value: "environments", label: "Environments" },
  { value: "animations", label: "Animations" },
  { value: "other", label: "Other" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most Popular" },
  { value: "rating", label: "Highest Rated" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
];

const FORMATS = [
  { value: "", label: "Any Format" },
  { value: "glb", label: "GLB" },
  { value: "gltf", label: "glTF" },
  { value: "fbx", label: "FBX" },
  { value: "obj", label: "OBJ" },
  { value: "usdz", label: "USDZ" },
];

export default function ProductFilters({ onApply }) {
  const { filters, setFilters } = useMarketplaceStore();

  const handleChange = (key, value) => {
    setFilters({ [key]: value });
  };

  const handleApply = () => {
    onApply?.();
  };

  const handleReset = () => {
    setFilters({
      q: "",
      category: "all",
      minPrice: "",
      maxPrice: "",
      format: "",
      sort: "newest",
      featured: false,
    });
    onApply?.();
  };

  return (
    <aside className="mp-filters" aria-label="Product filters">
      <div className="mp-filters-header">
        <SlidersHorizontal size={18} />
        <span>Filters</span>
      </div>

      {/* Category */}
      <div className="mp-filter-group">
        <label className="mp-filter-label">Category</label>
        <select
          className="mp-filter-select"
          value={filters.category}
          onChange={(e) => handleChange("category", e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Price Range */}
      <div className="mp-filter-group">
        <label className="mp-filter-label">Price Range (USD)</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            className="mp-filter-input"
            placeholder="Min"
            min="0"
            value={filters.minPrice}
            onChange={(e) => handleChange("minPrice", e.target.value)}
          />
          <span style={{ color: "#666", alignSelf: "center" }}>—</span>
          <input
            type="number"
            className="mp-filter-input"
            placeholder="Max"
            min="0"
            value={filters.maxPrice}
            onChange={(e) => handleChange("maxPrice", e.target.value)}
          />
        </div>
      </div>

      {/* Format */}
      <div className="mp-filter-group">
        <label className="mp-filter-label">File Format</label>
        <select
          className="mp-filter-select"
          value={filters.format}
          onChange={(e) => handleChange("format", e.target.value)}
        >
          {FORMATS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Sort */}
      <div className="mp-filter-group">
        <label className="mp-filter-label">Sort By</label>
        <select
          className="mp-filter-select"
          value={filters.sort}
          onChange={(e) => handleChange("sort", e.target.value)}
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Featured toggle */}
      <div className="mp-filter-group">
        <label className="mp-filter-checkbox">
          <input
            type="checkbox"
            checked={filters.featured}
            onChange={(e) => handleChange("featured", e.target.checked)}
          />
          Featured only
        </label>
      </div>

      <div className="mp-filter-actions">
        <button className="mp-btn mp-btn-primary" onClick={handleApply}>Apply Filters</button>
        <button className="mp-btn mp-btn-ghost" onClick={handleReset}>Reset</button>
      </div>
    </aside>
  );
}
