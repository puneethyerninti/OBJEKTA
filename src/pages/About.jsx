// src/pages/About.jsx
import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { ArrowRight, Zap, Users, Palette, Upload, Layers, Grid3X3, Sparkles, BookOpenText, ShieldCheck, Workflow } from "lucide-react";
import "../styles/AboutContact.css";

const CORE_CAPABILITIES = [
  {
    title: "GPU-Accelerated Rendering",
    desc: "WebGL 2 powered engine delivers PBR shading with real-time reflections and post-processing directly in the browser.",
    icon: <Zap className="feature-icon" />,
    color: "from-purple-500 to-cyan-500",
  },
  {
    title: "Real-Time Collaboration",
    desc: "Multiplayer scene editing with live cursors, shared viewports and instant version snapshots — teams stay in sync.",
    icon: <Users className="feature-icon" />,
    color: "from-cyan-500 to-blue-500",
  },
  {
    title: "Physically Based Materials",
    desc: "Full metalness-roughness PBR workflow with HDR environment lighting and accurate tone mapping.",
    icon: <Palette className="feature-icon" />,
    color: "from-pink-500 to-purple-500",
  },
  {
    title: "Resumable Asset Pipeline",
    desc: "Upload multi-gigabyte GLB files with tus-based resumable transfers and automatic thumbnail generation.",
    icon: <Upload className="feature-icon" />,
    color: "from-orange-500 to-pink-500",
  },
];

const TECH_STACK = [
  { name: "Three.js", desc: "Core 3D rendering", url: "https://threejs.org" },
  { name: "React Three Fiber", desc: "Declarative scenes", url: "https://docs.pmnd.rs/react-three-fiber" },
  { name: "glTF 2.0", desc: "Asset standard", url: "https://www.khronos.org/gltf/" },
  { name: "WebGL 2", desc: "GPU graphics", url: "https://www.khronos.org/webgl/" },
  { name: "Socket.IO", desc: "Collaboration", url: "https://socket.io" },
  { name: "tus Protocol", desc: "Uploads", url: "https://tus.io" },
];

const STATS = [
  { value: "< 2s", label: "Scene load time", icon: Zap },
  { value: "60 fps", label: "Render performance", icon: Sparkles },
  { value: "∞", label: "Collaboration scale", icon: Users },
  { value: "Zero", label: "Local installs", icon: Grid3X3 },
];

const DOCUMENTATION_TRACKS = [
  {
    title: "Getting Started",
    desc: "Account setup, first project creation, and baseline team workflow standards.",
    icon: <BookOpenText className="feature-icon" />,
    to: "/documentation",
  },
  {
    title: "Operational Workflow",
    desc: "Recommended production sequence from concept, review cycles, to final delivery.",
    icon: <Workflow className="feature-icon" />,
    to: "/projects",
  },
  {
    title: "Security and Access",
    desc: "Authentication, collaboration permissions, and project governance best practices.",
    icon: <ShieldCheck className="feature-icon" />,
    to: "/documentation",
  },
];

export default function About() {
  usePageTitle("About");
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="site-wrapper about-page">
      <main className="about-main">
        {/* Hero Section */}
        <section className="about-hero">
          <div className="about-hero-content">
            <div className="hero-badge">
              <Sparkles size={16} />
              About Objekta
            </div>
            <h1 className="about-hero-title">
              Professional <span className="gradient-text">3D Tooling</span> for the Web
            </h1>
            <p className="about-hero-desc">
              Objekta is a browser-native 3D studio engineered for design teams who need production-grade rendering,
              real-time collaboration and asset management — without the overhead of legacy desktop software.
            </p>
            <div className="about-hero-actions">
              <button
                onClick={() => navigate(user ? "/dashboard" : "/login")}
                className="btn btn-primary"
              >
                {user ? "Enter Studio" : "Get Started Free"}
                <ArrowRight size={18} />
              </button>
              <Link to="/gallery" className="btn btn-secondary">
                Explore Gallery
              </Link>
            </div>
          </div>
          <div className="about-hero-visual">
            <div className="hero-blob hero-blob-1"></div>
            <div className="hero-blob hero-blob-2"></div>
            <div className="hero-blob hero-blob-3"></div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="about-stats">
          <div className="section-header">
            <h2>Built for Performance</h2>
            <p>Metrics that matter to creators</p>
          </div>
          <div className="stats-grid">
            {STATS.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="stat-card">
                  <div className="stat-icon">
                    <Icon size={24} />
                  </div>
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Mission Section */}
        <section className="about-mission">
          <div className="mission-content">
            <div className="mission-text">
              <h2>Our Mission</h2>
              <p>
                We built Objekta to eliminate the gap between creative intent and production output. Professional 3D
                tooling shouldn't demand terabytes of local installs, expensive GPU workstations, or vendor lock-in.
              </p>
              <p className="text-muted">
                The browser is the most accessible creative platform on the planet — we're engineering it into
                the most capable one. From look-dev sessions to stakeholder reviews, Objekta keeps every team
                member in the same viewport regardless of their device or location.
              </p>
            </div>
            <div className="mission-visual">
              <div className="mission-card card-1">
                <Zap size={32} />
                <p>Fast</p>
              </div>
              <div className="mission-card card-2">
                <Users size={32} />
                <p>Collaborative</p>
              </div>
              <div className="mission-card card-3">
                <Layers size={32} />
                <p>Powerful</p>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities Section */}
        <section className="about-capabilities">
          <div className="section-header">
            <h2>Core Capabilities</h2>
            <p>The technology powering every scene</p>
          </div>
          <div className="capabilities-grid">
            {CORE_CAPABILITIES.map((cap, i) => (
              <div key={i} className="capability-card">
                <div className={`capability-icon bg-gradient ${cap.color}`}>
                  {cap.icon}
                </div>
                <h3>{cap.title}</h3>
                <p>{cap.desc}</p>
                <div className="card-accent"></div>
              </div>
            ))}
          </div>
        </section>

        {/* Tech Stack Section */}
        <section className="about-tech-stack">
          <div className="section-header">
            <h2>Built on Open Standards</h2>
            <p>No proprietary lock-in — your files stay portable</p>
          </div>
          <div className="tech-grid">
            {TECH_STACK.map((tech, i) => (
              <a
                key={i}
                href={tech.url}
                target="_blank"
                rel="noopener noreferrer"
                className="tech-card"
              >
                <div className="tech-card-content">
                  <h4>{tech.name}</h4>
                  <p>{tech.desc}</p>
                </div>
                <ArrowRight size={18} className="tech-arrow" />
              </a>
            ))}
          </div>
        </section>

        <section className="about-tech-stack">
          <div className="section-header">
            <h2>Documentation Center</h2>
            <p>Clear operating guidance for onboarding, delivery quality, and team collaboration.</p>
          </div>
          <div className="tech-grid">
            {DOCUMENTATION_TRACKS.map((item) => (
              <Link key={item.title} to={item.to} className="tech-card" aria-label={`Open ${item.title}`}>
                <div className="tech-card-content">
                  <h4 style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                    {item.icon}
                    {item.title}
                  </h4>
                  <p>{item.desc}</p>
                </div>
                <ArrowRight size={18} className="tech-arrow" />
              </Link>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="about-cta">
          <h2>Ready to Create?</h2>
          <p>Open the studio and bring your first scene to life — entirely in the browser.</p>
          <div className="cta-actions">
            <button
              onClick={() => navigate(user ? "/dashboard" : "/login")}
              className="btn btn-primary btn-lg"
            >
              {user ? "Enter Studio" : "Get Started Free"}
              <ArrowRight size={20} />
            </button>
            <Link to="/documentation" className="btn btn-outline btn-lg">
              View Documentation
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}