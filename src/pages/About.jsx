// src/pages/About.jsx
import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const CORE_CAPABILITIES = [
  {
    title: "GPU-Accelerated Rendering",
    desc: "WebGL 2 powered engine delivers PBR shading with real-time reflections and post-processing directly in the browser — zero installation overhead.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="about-icon" aria-hidden="true">
        <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Real-Time Collaboration",
    desc: "Multiplayer scene editing with live cursors, shared viewports and instant version snapshots — distributed teams stay in sync effortlessly.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="about-icon" aria-hidden="true">
        <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
        <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Physically Based Materials",
    desc: "Full metalness-roughness PBR workflow with HDR environment lighting, accurate tone mapping and material variant presets for production look-dev.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="about-icon" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "Resumable Asset Pipeline",
    desc: "Upload multi-gigabyte GLB files with tus-based resumable transfers. Automatic thumbnail generation, version history and CDN-backed delivery.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="about-icon" aria-hidden="true">
        <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const TECH_STACK = [
  { name: "Three.js", desc: "Core 3D rendering engine", url: "https://threejs.org" },
  { name: "React Three Fiber", desc: "Declarative scene graph", url: "https://docs.pmnd.rs/react-three-fiber" },
  { name: "glTF 2.0 / GLB", desc: "Open asset format standard", url: "https://www.khronos.org/gltf/" },
  { name: "WebGL 2", desc: "GPU-accelerated graphics API", url: "https://www.khronos.org/webgl/" },
  { name: "Socket.IO", desc: "Real-time collaboration transport", url: "https://socket.io" },
  { name: "tus Protocol", desc: "Resumable upload standard", url: "https://tus.io" },
];

const STATS = [
  { value: "< 2s", label: "Average scene load time" },
  { value: "glTF", label: "Industry-standard format" },
  { value: "60 fps", label: "Target render performance" },
  { value: "Zero", label: "Desktop installs required" },
];

export default function About() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="site-wrapper">
      <main className="home-shell">
        {/* Hero */}
        <section className="text-center" style={{ animation: "fadeInUp 0.7s ease-out" }}>
          <span className="hero-badge-top">About Objekta</span>
          <h1 className="hero-title" style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
            Professional <span className="title-gradient">3D Tooling</span> for the Web
          </h1>
          <p className="hero-subtitle" style={{ maxWidth: "720px", margin: "0 auto" }}>
            Objekta is a browser-native 3D studio engineered for design teams who need production-grade
            rendering, real-time collaboration and asset management — without the overhead of legacy desktop software.
          </p>
        </section>

        {/* Stats row */}
        <section className="about-stats-grid" style={{ animation: "fadeInUp 0.8s ease-out" }}>
          {STATS.map((stat) => (
            <div key={stat.label} className="about-stat-card panel-glass">
              <div className="about-stat-value">{stat.value}</div>
              <div className="about-stat-label">{stat.label}</div>
            </div>
          ))}
        </section>

        {/* Mission */}
        <section className="panel-glass neon-rim about-mission-panel" style={{ animation: "fadeInUp 0.85s ease-out" }}>
          <div style={{ maxWidth: "820px", margin: "0 auto" }}>
            <h2 className="section-title" style={{ marginBottom: "1.5rem" }}>Our Mission</h2>
            <p className="about-body-text">
              We built Objekta to eliminate the gap between creative intent and production output. Professional 3D
              tooling shouldn't demand terabytes of local installs, expensive GPU workstations, or vendor lock-in.
              The browser is the most accessible creative platform on the planet — we're engineering it into
              the most capable one.
            </p>
            <p className="about-body-text-muted">
              From look-dev sessions to stakeholder reviews, Objekta keeps every team member in the same viewport
              regardless of their device or location. WebGL 2 handles real-time rendering; the cloud handles
              persistence and collaboration. Your team focuses on what matters — the creative work.
            </p>
          </div>
        </section>

        {/* Core Capabilities */}
        <section style={{ animation: "fadeInUp 0.9s ease-out" }}>
          <div className="text-center" style={{ marginBottom: "3rem" }}>
            <h2 className="section-title">Core Capabilities</h2>
            <p className="section-subtitle">The technology powering every scene</p>
          </div>
          <div className="about-capabilities-grid">
            {CORE_CAPABILITIES.map((cap) => (
              <article key={cap.title} className="about-capability-card panel-glass" data-tilt="4">
                <div className="about-capability-icon">{cap.icon}</div>
                <h3 className="about-capability-title">{cap.title}</h3>
                <p className="about-capability-desc">{cap.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Technology Stack */}
        <section style={{ animation: "fadeInUp 0.95s ease-out" }}>
          <div className="text-center" style={{ marginBottom: "2.5rem" }}>
            <h2 className="section-title">Built on Open Standards</h2>
            <p className="section-subtitle">No proprietary lock-in — your files stay portable</p>
          </div>
          <div className="about-tech-grid">
            {TECH_STACK.map((tech) => (
              <a
                key={tech.name}
                href={tech.url}
                target="_blank"
                rel="noopener noreferrer"
                className="about-tech-card panel-glass"
              >
                <h4 className="about-tech-name">{tech.name}</h4>
                <p className="about-tech-desc">{tech.desc}</p>
                <span className="about-tech-arrow">&#8599;</span>
              </a>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="panel-glass neon-rim about-cta-panel" style={{ animation: "fadeInUp 1.05s ease-out" }}>
          <h2 className="section-title" style={{ marginBottom: "1rem" }}>Ready to Create?</h2>
          <p className="section-subtitle" style={{ marginBottom: "2rem" }}>
            Open the studio and bring your first scene to life — entirely in the browser.
          </p>
          <div className="hero-actions" style={{ justifyContent: "center" }}>
            <button
              onClick={() => navigate(user ? "/dashboard" : "/login")}
              className="cta-button cta-primary"
              data-magnetic="0.15"
            >
              {user ? "Enter Studio" : "Get Started Free"}
            </button>
            <Link to="/gallery" className="cta-button cta-secondary" data-magnetic="0.1">
              Explore Gallery
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}