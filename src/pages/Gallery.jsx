import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const GALLERY_ITEMS = [
  {
    title: "Command Desk",
    tag: "Product Viz",
    desc: "UI overlays, lighting variants, and material states ready for review.",
    poster: "/assets/desk-poster.webp",
    likes: 234,
    views: 1.2,
  },
  {
    title: "Portable Rig",
    tag: "Studio Kit",
    desc: "Shader diagnostics layered with live annotations and QA checkpoints.",
    poster: "/assets/laptop-poster.webp",
    likes: 189,
    views: 0.9,
  },
  {
    title: "Concept Vehicle",
    tag: "Automotive",
    desc: "Hero-grade reflections, trim decals, and realtime paint swaps.",
    poster: "/assets/porsche-poster.webp",
    likes: 456,
    views: 2.1,
  },
  {
    title: "Neon Workspace",
    tag: "Environment",
    desc: "Atmospheric lighting tuned for multi-angle client reviews.",
    gradient: "linear-gradient(135deg, rgba(58,180,255,0.35), rgba(127,90,240,0.45))",
    likes: 312,
    views: 1.5,
  },
  {
    title: "Hologram HUD",
    tag: "UX Prototype",
    desc: "Floating panels and HUD layouts for gesture-driven tooling.",
    gradient: "linear-gradient(135deg, rgba(0,255,209,0.25), rgba(58,180,255,0.35))",
    likes: 278,
    views: 1.3,
  },
  {
    title: "Material Lab",
    tag: "Look Dev",
    desc: "Procedural mats, tone mapping, and ACES preview calibration.",
    gradient: "linear-gradient(135deg, rgba(255,182,66,0.28), rgba(127,90,240,0.35))",
    likes: 201,
    views: 1.1,
  },
  {
    title: "Cyberpunk City",
    tag: "Environment",
    desc: "Neon-lit streets with volumetric fog and dynamic lighting.",
    gradient: "linear-gradient(135deg, rgba(255,0,128,0.3), rgba(127,90,240,0.4))",
    likes: 389,
    views: 1.8,
  },
  {
    title: "Product Showcase",
    tag: "Product Viz",
    desc: "Photorealistic materials with HDR environment lighting.",
    gradient: "linear-gradient(135deg, rgba(127,90,240,0.3), rgba(58,180,255,0.3))",
    likes: 267,
    views: 1.4,
  },
  {
    title: "Robot Character",
    tag: "Character Design",
    desc: "PBR materials and rigged animation ready for real-time rendering.",
    gradient: "linear-gradient(135deg, rgba(0,215,255,0.3), rgba(127,90,240,0.35))",
    likes: 445,
    views: 2.0,
  },
];

const GALLERY_FILTERS = ["All", "Product Viz", "Automotive", "Environment", "UX Prototype", "Look Dev", "Character Design"];

const FEATURED_CREATORS = [
  { name: "Sarah Chen", projects: 24, icon: "👩‍🎨" },
  { name: "Marcus Lee", projects: 18, icon: "👨‍💻" },
  { name: "Emma Wilson", projects: 31, icon: "🎨" },
  { name: "Alex Rivera", projects: 27, icon: "✨" },
];

export default function Gallery() {
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [likedItems, setLikedItems] = useState(new Set());
  const cardsRef = useRef([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
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

  const handleLike = (title) => {
    setLikedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(title)) {
        newSet.delete(title);
      } else {
        newSet.add(title);
      }
      return newSet;
    });
  };

  const filteredItems = selectedFilter === "All" 
    ? GALLERY_ITEMS 
    : GALLERY_ITEMS.filter(item => item.tag === selectedFilter);

  return (
    <div className="site-wrapper">
      {/* Background effects */}
      <div className="grid-glow" aria-hidden="true" />
      <div className="scanline-overlay" aria-hidden="true" />

      <main className="home-shell">
        {/* Hero Section */}
        <section className="text-center mb-12" style={{ animation: 'fade-up 0.7s ease-out' }}>
          <span className="hero-badge-top" style={{ display: 'inline-block', marginBottom: '1.5rem' }}>
            Showcase
          </span>
          <h1 className="hero-title" style={{ marginBottom: '1.5rem' }}>
            Explore Creative
            <span className="title-gradient"> Excellence</span>
          </h1>
          <p className="hero-subtitle" style={{ maxWidth: '720px', margin: '0 auto 2rem' }}>
            Discover curated 3D scenes, lighting passes, and interactive prototypes created by our global community of designers.
          </p>
          <div className="hero-actions" style={{ justifyContent: 'center' }}>
            <button 
              onClick={() => navigate(user ? '/dashboard' : '/login')} 
              className="cta-button cta-primary"
              data-magnetic="0.15"
            >
              {user ? 'Upload Your Work' : 'Start Creating'}
            </button>
            <Link to="/projects" className="cta-button cta-secondary" data-magnetic="0.1">
              View Projects
            </Link>
          </div>
        </section>

        {/* Stats Bar */}
        <section className="panel-glass" style={{ padding: '1.5rem', borderRadius: '16px', marginBottom: '3rem', animation: 'fade-up 0.8s ease-out' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--brand-teal)', marginBottom: '0.25rem' }}>
                1.2K+
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Total Projects</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--brand-teal)', marginBottom: '0.25rem' }}>
                500+
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Creators</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--brand-teal)', marginBottom: '0.25rem' }}>
                15M+
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Total Views</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--brand-teal)', marginBottom: '0.25rem' }}>
                98%
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Satisfaction</div>
            </div>
          </div>
        </section>

        {/* Filter Section */}
        <section className="flex flex-wrap justify-center gap-3 mb-12" style={{ animation: 'fade-up 0.85s ease-out' }}>
          {GALLERY_FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className="cta-button"
              style={{
                background: selectedFilter === filter ? 'linear-gradient(135deg, var(--brand-purple), var(--brand-teal))' : 'rgba(127,90,240,0.1)',
                color: selectedFilter === filter ? '#fff' : 'var(--text-muted)',
                border: selectedFilter === filter ? 'none' : '1px solid rgba(127,90,240,0.3)',
                padding: '0.6rem 1.2rem',
                fontSize: '0.9rem',
                fontWeight: selectedFilter === filter ? '700' : '500'
              }}
            >
              {filter}
            </button>
          ))}
        </section>

        {/* Gallery Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {filteredItems.map((item, idx) => (
            <article
              key={item.title}
              ref={(el) => (cardsRef.current[idx] = el)}
              className="panel-glass card-3d showcase-card"
              style={{ borderRadius: '16px', overflow: 'hidden', cursor: 'pointer' }}
              data-tilt="4"
            >
              <div
                className="h-48 w-full"
                style={{
                  backgroundImage: item.poster ? `url(${item.poster})` : item.gradient,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  position: 'relative'
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  display: 'flex',
                  gap: '0.5rem'
                }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike(item.title);
                    }}
                    style={{
                      background: 'rgba(8,10,26,0.8)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(127,90,240,0.3)',
                      borderRadius: '8px',
                      padding: '0.5rem 0.75rem',
                      color: likedItems.has(item.title) ? '#ff3366' : '#fff',
                      cursor: 'pointer',
                      fontSize: '1.2rem'
                    }}
                  >
                    {likedItems.has(item.title) ? '❤️' : '🤍'}
                  </button>
                </div>
              </div>
              <div style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--brand-teal)', fontWeight: '700' }}>
                    {item.tag}
                  </span>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <span>👁 {item.views}K</span>
                    <span>❤️ {item.likes + (likedItems.has(item.title) ? 1 : 0)}</span>
                  </div>
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '0.5rem' }}>{item.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>{item.desc}</p>
                <button
                  className="cta-button cta-secondary"
                  style={{ width: '100%', marginTop: '1rem', padding: '0.6rem', fontSize: '0.9rem' }}
                >
                  View Details
                </button>
              </div>
            </article>
          ))}
        </section>

        {/* Featured Creators */}
        <section style={{ marginBottom: '4rem' }}>
          <div className="text-center" style={{ marginBottom: '3rem' }}>
            <h2 className="section-title">Featured Creators</h2>
            <p className="section-subtitle">Top contributors this month</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {FEATURED_CREATORS.map((creator, idx) => (
              <article
                key={creator.name}
                ref={(el) => (cardsRef.current[idx + 20] = el)}
                className="panel-glass card-3d"
                style={{ padding: '2rem', borderRadius: '16px', textAlign: 'center', cursor: 'pointer' }}
                data-tilt="5"
              >
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>{creator.icon}</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                  {creator.name}
                </h3>
                <p style={{ color: 'var(--brand-teal)', fontSize: '0.85rem', fontWeight: '600' }}>
                  {creator.projects} Projects
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="panel-glass neon-rim" style={{ padding: '4rem 2rem', borderRadius: '24px', textAlign: 'center' }}>
          <h2 className="section-title" style={{ marginBottom: '1rem' }}>
            Want to feature your work here?
          </h2>
          <p className="section-subtitle" style={{ marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem' }}>
            Join our community and showcase your 3D creations to thousands of designers worldwide.
          </p>
          <div className="hero-actions" style={{ justifyContent: 'center' }}>
            <button 
              onClick={() => navigate(user ? '/dashboard' : '/login')} 
              className="cta-button cta-primary"
              data-magnetic="0.18"
            >
              {user ? 'Upload Project' : 'Join Now'}
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
