// src/components/marketplace/SearchBar.jsx
import React, { useState, useCallback } from "react";
import { Search, X } from "lucide-react";

export default function SearchBar({ value = "", onSearch, placeholder = "Search 3D models..." }) {
  const [input, setInput] = useState(value);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      onSearch?.(input.trim());
    },
    [input, onSearch]
  );

  const handleClear = () => {
    setInput("");
    onSearch?.("");
  };

  return (
    <form className="mp-search-bar" onSubmit={handleSubmit} role="search">
      <Search size={18} className="mp-search-icon" />
      <input
        type="text"
        className="mp-search-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        aria-label="Search marketplace"
      />
      {input && (
        <button type="button" className="mp-search-clear" onClick={handleClear} aria-label="Clear search">
          <X size={16} />
        </button>
      )}
      <button type="submit" className="mp-search-btn">
        Search
      </button>
    </form>
  );
}
