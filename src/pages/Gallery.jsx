import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const GALLERY_ITEMS = [
  {
    title: "Command Desk",
    tag: "Product Viz",
    desc: "UI overlays, lighting variants, and material states ready for review.",
    poster: "/assets/desk-poster.webp",
  },
  {
    title: "Portable Rig",
    tag: "Studio Kit",
    desc: "Shader diagnostics layered with live annotations and QA checkpoints.",
    poster: "/assets/laptop-poster.webp",
  },
  {
    title: "Concept Vehicle",
    tag: "Automotive",
    desc: "Hero-grade reflections, trim decals, and realtime paint swaps.",
    poster: "/assets/porsche-poster.webp",
  },
  {
    title: "Neon Workspace",
    tag: "Environment",
    desc: "Atmospheric lighting tuned for multi-angle client reviews.",
    gradient: "linear-gradient(135deg, rgba(58,180,255,0.35), rgba(127,90,240,0.45))",
  },
  {
    title: "Hologram HUD",
    tag: "UX Prototype",
    desc: "Floating panels and HUD layouts for gesture-driven tooling.",
    gradient: "linear-gradient(135deg, rgba(0,255,209,0.25), rgba(58,180,255,0.35))",
  },
  {
    title: "Material Lab",
    tag: "Look Dev",
    desc: "Procedural mats, tone mapping, and ACES preview calibration.",
    gradient: "linear-gradient(135deg, rgba(255,182,66,0.28), rgba(127,90,240,0.35))",
  },
  {
    title: "Cyberpunk City",
    tag: "Environment",
    desc: "Neon-lit streets with volumetric fog and dynamic lighting.",
    gradient: "linear-gradient(135deg, rgba(255,0,128,0.3), rgba(127,90,240,0.4))",
  },
  {
    title: "Product Showcase",
    tag: "Product Viz",
    desc: "Photorealistic materials with HDR environment lighting.",
    gradient: "linear-gradient(135deg, rgba(127,90,240,0.3), rgba(58,180,255,0.3))",
  },
  {
    title: "Robot Character",
    tag: "Character Design",
    desc: "PBR materials and rigged animation ready for real-time rendering.",
    gradient: "linear-gradient(135deg, rgba(0,215,255,0.3), rgba(127,90,240,0.35))",
  },
];

const GALLERY_FILTERS = ["All", "Product Viz", "Automotive", "Environment", "UX Prototype", "Look Dev", "Character Design"];

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
      { threshold: 0.1 }
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
        <section className="text-center" style={{ animation: "fade-up 0.7s ease-out" }}>
          <span className="hero-badge-top">Scene Gallery</span>
          <h1 className="hero-title" style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
            Explore Creative
            <span className="title-gradient"> Excellence</span>
          </h1>
          <p className="hero-subtitle" style={{ maxWidth: "680px", margin: "0 auto 2rem" }}>
            Curated 3D scenes, lighting passes, and interactive prototypes â€” each one built and reviewed
            directly in the Objekta studio.
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
          className="flex flex-wrap justify-center gap-3"
          style={{ animation: "fade-up 0.85s ease-out" }}
          aria-label="Filter gallery by category"
        >
          {GALLERY_FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className="cta-button"
              aria-pressed={selectedFilter === filter}
              style={{
                background:
                  selectedFilter === filter
                    ? "linear-gradient(135deg, var(--brand-purple), var(--brand-teal))"
                    : "rgba(127,90,240,0.1)",
                color: selectedFilter === filter ? "#fff" : "var(--text-muted)",
                border: selectedFilter === filter ? "none" : "1px solid rgba(127,90,240,0.3)",
                padding: "0.6rem 1.2rem",
                fontSize: "0.9rem",
                fontWeight: selectedFilter === filter ? "700" : "500",
              }}
            >
              {filter}
            </button>
          ))}
        </section>

        {/* Gallery Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredItems.map((item, idx) => (
            <article
              key={item.title}
              ref={(el) => (cardsRef.current[idx] = el)}
              className="panel-glass card-3d showcase-card"
              style={{ borderRadius: "16px", overflow: "hidden", cursor: "pointer" }}
              data-tilt="4"
            >
              {/* Thumbnail */}
              <div
                className="h-48 w-full"
                style={{
                  backgroundImage: item.poster ? `url(${item.poster})` : item.gradient,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />

              {/* Card Body */}
              <div style={{ padding: "1.5rem" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--brand-teal)",
                    fontWeight: "700",
                  }}
                >
                  {item.tag}
                </span>
                <h3 style={{ fontSize: "1.2rem", fontWeight: "700", margin: "0.5rem 0 0.4rem" }}>
                  {item.title}
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: "1.55", margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            </article>
          ))}
        </section>

        {/* CTA */}
        <section
          className="panel-glass neon-rim"
          style={{ padding: "4rem 2rem", borderRadius: "24px", textAlign: "center" }}
        >
          <h2 className="section-title" style={{ marginBottom: "1rem" }}>
            Want to feature your work here?
          </h2>
          <p className="section-subtitle" style={{ marginBottom: "2rem", maxWidth: "600px", margin: "0 auto 2rem" }}>
            Build your scene in Objekta and share it with the community.
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
