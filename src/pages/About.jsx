// src/pages/About.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const ABOUT_FEATURES = [
  {
    title: "GPU-Accelerated Rendering",
    desc: "WebGL 2 powered engine runs PBR shading with realtime reflections and post-processing in the browser — no install required.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="about-feature-svg" aria-hidden="true">
        <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Real-Time Collaboration",
    desc: "Multiplayer scene state, live cursors and instant version snapshots let distributed teams review and iterate together.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="about-feature-svg" aria-hidden="true">
        <path d="M20 7L12 3L4 7M20 7L12 11M20 7V17L12 21M12 11L4 7M12 11V21M4 7V17L12 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Physically Based Materials",
    desc: "Full PBR metalness-roughness workflow with HDR environment lighting and accurate tone mapping for look-dev previews.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="about-feature-svg" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
];

export default function About() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="site-wrapper">
      <main className="home-shell">
        {/* Hero */}
        <section className="text-center" style={{ animation: "fade-up 0.7s ease-out" }}>
          <span className="hero-badge-top">About Objekta</span>
          <h1 className="hero-title" style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
            Redefining <span className="title-gradient">3D Creation</span>
          </h1>
          <p className="hero-subtitle" style={{ maxWidth: "680px", margin: "0 auto" }}>
            A browser-native 3D studio built for design teams who need professional-grade tools without
            the overhead of legacy desktop software.
          </p>
        </section>

        {/* Mission */}
        <section
          className="panel-glass neon-rim"
          style={{ padding: "clamp(2rem,5vw,3.5rem)", borderRadius: "24px", animation: "fade-up 0.8s ease-out" }}
        >
          <div style={{ maxWidth: "820px", margin: "0 auto" }}>
            <h2 className="section-title" style={{ marginBottom: "1.5rem" }}>Our Mission</h2>
            <p style={{ color: "var(--text-light)", lineHeight: "1.8", marginBottom: "1.25rem", fontSize: "1.05rem" }}>
              Objekta was built to remove the friction between creative intent and production output. We believe
              professional 3D tooling shouldn't require terabytes of local installs, expensive workstations, or
              platform lock-in. The browser is the most accessible creative surface on the planet — we're making
              it the most capable one too.
            </p>
            <p style={{ color: "var(--text-muted)", lineHeight: "1.8", fontSize: "0.975rem" }}>
              From look-dev sessions to stakeholder reviews, Objekta keeps every collaborator in the same
              viewport regardless of their device. WebGL 2 handles the rendering; the cloud handles persistence.
              Your team handles the creative work.
            </p>
          </div>
        </section>

        {/* Feature Highlights */}
        <section style={{ animation: "fade-up 0.9s ease-out" }}>
          <div className="text-center" style={{ marginBottom: "3rem" }}>
            <h2 className="section-title">Capabilities</h2>
            <p className="section-subtitle">Core technology that powers the studio</p>
          </div>
          <div className="about-features">
            {ABOUT_FEATURES.map((feat) => (
              <div key={feat.title} className="feature-highlight panel-glass">
                <div className="about-feature-icon-wrap">{feat.icon}</div>
                <h4>{feat.title}</h4>
                <p>{feat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Technology stack note */}
        <section
          className="panel-glass"
          style={{ padding: "2rem 2.5rem", borderRadius: "20px", animation: "fade-up 1s ease-out" }}
        >
          <h2 className="section-title" style={{ marginBottom: "1rem", fontSize: "1.4rem" }}>Built On Open Web Standards</h2>
          <p style={{ color: "var(--text-muted)", lineHeight: "1.8", maxWidth: "780px" }}>
            The entire rendering pipeline runs on WebGL 2 via Three.js and React Three Fiber. Assets follow
            the open glTF 2.0 / GLB standard. Collaboration is powered by Socket.IO over WebSockets. Nothing
            proprietary is required — your files stay portable.
          </p>
        </section>

        {/* CTA */}
        <section className="text-center" style={{ animation: "fade-up 1.1s ease-out" }}>
          <h2 className="section-title" style={{ marginBottom: "1rem" }}>Start Building</h2>
          <p className="section-subtitle" style={{ marginBottom: "2rem" }}>
            Open the studio and bring your first scene to life in the browser.
          </p>
          <button
            onClick={() => navigate(user ? "/dashboard" : "/login")}
            className="cta-button cta-primary"
            data-magnetic="0.15"
          >
            {user ? "Enter Studio" : "Open Studio"}
          </button>
        </section>
      </main>
    </div>
  );
}