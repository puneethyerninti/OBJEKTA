// src/pages/Gallery.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePageTitle } from "../hooks/usePageTitle";
import "../styles/PremiumPages.css";

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
  usePageTitle("Gallery");
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
    <div className="site-wrapper gallery-page-premium">
      <main className="gallery-main-premium">
        {/* Hero Section */}
        <section className="gallery-header-premium">
          <h1>Creative <span className="gradient-text">Showcase</span></h1>
          <p>
            Browse curated 3D scenes built and reviewed in Objekta — from product visualization and
            automotive design to character rigs and immersive environments.
          </p>
        </section>

        {/* Filter Bar */}
        <section
          className="gallery-filter-bar"
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
        <section className="gallery-grid-premium">
          <p className="sr-only" aria-live="polite">
            Showing {filteredItems.length} gallery {filteredItems.length === 1 ? "item" : "items"}.
          </p>
          {filteredItems.map((item, idx) => (
            <article
              key={item.title}
              ref={(el) => (cardsRef.current[idx] = el)}
              className="gallery-card-premium"
            >
              {/* Thumbnail */}
              <div
                className="gallery-card-image-premium"
                style={{
                  backgroundImage: item.poster ? `url(${item.poster})` : item.gradient,
                }}
              />

              {/* Card Body */}
              <div className="gallery-card-content-premium">
                <span className="gallery-card-tag-premium">{item.tag}</span>
                <h3 className="gallery-card-title-premium">{item.title}</h3>
                <p className="gallery-card-desc-premium">{item.desc}</p>
              </div>
            </article>
          ))}
          {filteredItems.length === 0 && (
            <article style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
              <h3 style={{ color: 'white', marginBottom: '1rem' }}>No scenes in this category</h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '2rem' }}>Try a different filter or upload a new scene from the studio.</p>
              <button
                onClick={() => setSelectedFilter("All")}
                className="btn btn-secondary"
              >
                View All Scenes
              </button>
            </article>
          )}
        </section>

        {/* CTA Section */}
        <section className="about-cta" style={{ marginTop: '4rem' }}>
          <h2>Want to feature your work?</h2>
          <p>
            Build a scene in Objekta and share it with the community — the best submissions are featured here.
          </p>
          <div className="cta-actions">
            <button
              onClick={() => navigate(user ? "/dashboard" : "/login")}
              className="btn btn-primary btn-lg"
            >
              {user ? "Open Studio" : "Join Now"}
            </button>
            <a href="/projects" className="btn btn-secondary btn-lg">
              View All Projects
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
