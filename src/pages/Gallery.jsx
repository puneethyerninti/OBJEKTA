// src/pages/Gallery.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const GALLERY_ITEMS = [
  {
    title: "Command Desk",
    tag: "Product Viz",
    desc: "Multi-screen command center with studio lighting and material variants for stakeholder approvals.",
    poster: "/assets/desk-poster.webp",
    accent: "violet",
  },
  {
    title: "Portable Rig",
    tag: "Studio Kit",
    desc: "Travel-ready workstation with shader diagnostics, live annotations, and QA checkpoints.",
    poster: "/assets/laptop-poster.webp",
    accent: "cyan",
  },
  {
    title: "Concept Vehicle",
    tag: "Automotive",
    desc: "Hero-grade exterior with reflective clear-coat, trim decals, and real-time paint swaps for design iteration.",
    poster: "/assets/porsche-poster.webp",
    accent: "amber",
  },
  {
    title: "Black Dragon",
    tag: "Character Design",
    desc: "Fully rigged creature with idle animation, layered PBR skin detail, and subsurface scattering setup.",
    gradient: "linear-gradient(135deg, rgba(167,139,250,0.35), rgba(127,90,240,0.45))",
    accent: "violet",
  },
  {
    title: "Flynn's Arcade",
    tag: "Environment",
    desc: "Neon-lit retro interior with volumetric fog, emissive signage, and cinematic depth-of-field passes.",
    gradient: "linear-gradient(135deg, rgba(0,215,255,0.25), rgba(58,180,255,0.35))",
    accent: "cyan",
  },
  {
    title: "Gipsy Avenger",
    tag: "Mech Design",
    desc: "High-poly mech-scale asset with metallic weathering, panel lines, and optimized LOD variants.",
    gradient: "linear-gradient(135deg, rgba(255,154,62,0.28), rgba(127,90,240,0.35))",
    accent: "amber",
  },
  {
    title: "iPhone 17 Pro",
    tag: "Product Viz",
    desc: "Product launch mockup with studio-grade lighting, configurable finishes, and AR-ready export.",
    gradient: "linear-gradient(135deg, rgba(0,215,255,0.3), rgba(127,90,240,0.35))",
    accent: "cyan",
  },
  {
    title: "Retail Pop-up Set",
    tag: "Environment",
    desc: "Modular retail booth scene with day/night lighting variants and configurable branding panels.",
    gradient: "linear-gradient(135deg, rgba(255,0,128,0.3), rgba(127,90,240,0.4))",
    accent: "violet",
  },
  {
    title: "Wearable Device",
    tag: "Product Viz",
    desc: "Campaign-ready smartwatch scene with configurable straps, dials, and material presets.",
    gradient: "linear-gradient(135deg, rgba(127,90,240,0.3), rgba(58,180,255,0.3))",
    accent: "amber",
  },
];

const GALLERY_FILTERS = [
  "All",
  "Product Viz",
  "Automotive",
  "Environment",
  "Character Design",
  "Mech Design",
  "Studio Kit",
];

export default function Gallery() {
  const [selectedFilter, setSelectedFilter] = useState("All");
  const cardsRef = useRef([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.08 }
    );
    cardsRef.current.forEach((card) => {
      if (card) observer.observe(card);
    });
    return () => observer.disconnect();
  }, [selectedFilter]);

  const filteredItems =
    selectedFilter === "All"
      ? GALLERY_ITEMS
      : GALLERY_ITEMS.filter((item) => item.tag === selectedFilter);

  return (
    <div className="site-wrapper">
      <main className="home-shell">
        {/* Hero */}
        <section className="text-center" style={{ animation: "fadeInUp 0.7s ease-out" }}>
          <span className="hero-badge-top">Scene Gallery</span>
          <h1 className="hero-title" style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
            Creative <span className="title-gradient">Showcase</span>
          </h1>
          <p className="hero-subtitle" style={{ maxWidth: "700px", margin: "0 auto 2rem" }}>
            Browse curated 3D scenes built and reviewed in Objekta — from product visualization and
            automotive design to character rigs and immersive environments.
          </p>
          <div className="hero-actions" style={{ justifyContent: "center" }}>
            <button
              onClick={() => navigate(user ? "/dashboard" : "/login")}
              className="cta-button cta-primary"
              data-magnetic="0.15"
            >
              {user ? "Upload Your Work" : "Start Creating"}
            </button>
            <Link to="/projects" className="cta-button cta-secondary" data-magnetic="0.1">
              View Projects
            </Link>
          </div>
        </section>

        {/* Filter Bar */}
        <section
          className="gallery-filter-bar"
          style={{ animation: "fadeInUp 0.85s ease-out" }}
          aria-label="Filter by category"
        >
          {GALLERY_FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`gallery-filter-btn${selectedFilter === filter ? " active" : ""}`}
              aria-pressed={selectedFilter === filter}
            >
              {filter}
            </button>
          ))}
        </section>

        {/* Gallery Grid */}
        <section className="gallery-grid">
          <p className="sr-only" aria-live="polite">
            Showing {filteredItems.length} gallery {filteredItems.length === 1 ? "item" : "items"}.
          </p>
          {filteredItems.map((item, idx) => (
            <article
              key={item.title}
              ref={(el) => (cardsRef.current[idx] = el)}
              className={`gallery-card panel-glass showcase-card gallery-accent-${item.accent}`}
              data-tilt="4"
            >
              {/* Thumbnail */}
              <div
                className="gallery-card-thumb"
                style={{
                  backgroundImage: item.poster ? `url(${item.poster})` : item.gradient,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />

              {/* Card Body */}
              <div className="gallery-card-body">
                <span className="gallery-card-tag">{item.tag}</span>
                <h3 className="gallery-card-title">{item.title}</h3>
                <p className="gallery-card-desc">{item.desc}</p>
              </div>
            </article>
          ))}
          {filteredItems.length === 0 && (
            <article className="gallery-empty panel-glass">
              <h3>No scenes in this category</h3>
              <p>Try a different filter or upload a new scene from the studio.</p>
              <button
                onClick={() => setSelectedFilter("All")}
                className="cta-button cta-secondary"
                data-magnetic="0.1"
              >
                View All Scenes
              </button>
            </article>
          )}
        </section>

        {/* CTA */}
        <section className="panel-glass neon-rim gallery-cta-panel">
          <h2 className="section-title" style={{ marginBottom: "1rem" }}>
            Want to feature your work?
          </h2>
          <p className="section-subtitle" style={{ marginBottom: "2rem", maxWidth: "600px", margin: "0 auto 2rem" }}>
            Build a scene in Objekta and share it with the community — the best submissions are featured here.
          </p>
          <div className="hero-actions" style={{ justifyContent: "center" }}>
            <button
              onClick={() => navigate(user ? "/dashboard" : "/login")}
              className="cta-button cta-primary"
              data-magnetic="0.18"
            >
              {user ? "Open Studio" : "Join Now"}
            </button>
            <Link to="/projects" className="cta-button cta-secondary" data-magnetic="0.1">
              View All Projects
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
