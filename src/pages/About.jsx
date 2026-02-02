// src/pages/About.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function About() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="site-wrapper">
      {/* Background effects */}
      <div className="grid-glow" aria-hidden="true" />
      <div className="scanline-overlay" aria-hidden="true" />

      <main className="home-shell">
        <section className="about-section">
          <div className="about-header">
            <h2 className="section-title">Redefining 3D Creation</h2>
            <p className="section-subtitle">
              Where innovation meets immersion in the browser.
            </p>
          </div>
          <div className="about-content">
            <div className="about-text">
              <p>
                Objekta represents the future of 3D design—a revolutionary platform that brings professional-grade
                tools directly to your browser. Born from the vision of democratizing creative technology, we've
                eliminated the barriers between imagination and execution.
              </p>
              <p>
                Our WebGL-powered engine delivers desktop-level performance with zero installation. Experience
                real-time collaboration, advanced material systems, and GPU-accelerated rendering that rivals
                traditional CAD software. From concept to production, Objekta empowers creators to build
                extraordinary worlds without compromise.
              </p>
              <div className="about-features">
                <div className="feature-highlight">
                  <div className="feature-icon">⚡</div>
                  <h4>Lightning Fast</h4>
                  <p>Sub-second rendering with WebAssembly acceleration</p>
                </div>
                <div className="feature-highlight">
                  <div className="feature-icon">🌐</div>
                  <h4>Cloud Native</h4>
                  <p>Seamless collaboration across any device, anywhere</p>
                </div>
                <div className="feature-highlight">
                  <div className="feature-icon">🎨</div>
                  <h4>Physically Based</h4>
                  <p>Industry-standard PBR materials and lighting</p>
                </div>
              </div>
            </div>
            <div className="about-stats">
              <div className="stat-item">
                <span className="stat-number">25k+</span>
                <span className="stat-label">Creative Professionals</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">500k+</span>
                <span className="stat-label">3D Scenes Built</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">4.9/5</span>
                <span className="stat-label">User Satisfaction</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">24/7</span>
                <span className="stat-label">Global Support</span>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="text-center py-16">
          <h2 className="section-title mb-4">Ready to Transform Your Workflow?</h2>
          <p className="section-subtitle mb-8">
            Join thousands of creators already building with Objekta.
          </p>
          <button
            onClick={() => navigate(user ? '/dashboard' : '/login')}
            className="cta-button cta-primary"
            data-magnetic="0.15"
          >
            {user ? 'Enter Studio' : 'Start Free Trial'}
          </button>
        </section>
      </main>
    </div>
  );
}