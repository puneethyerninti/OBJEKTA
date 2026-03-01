// src/components/Footer.jsx
import React from "react";
import { Link } from "react-router-dom";

const FOOTER_LINKS = [
  {
    heading: "Product",
    links: [
      { label: "Studio",    to: "/login"     },
      { label: "Gallery",   to: "/gallery"   },
      { label: "Projects",  to: "/projects"  },
      { label: "Dashboard", to: "/dashboard" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About",   to: "/about"   },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    heading: "Technology",
    links: [
      { label: "Three.js",           href: "https://threejs.org",                          external: true },
      { label: "React Three Fiber",  href: "https://docs.pmnd.rs/react-three-fiber",       external: true },
      { label: "glTF 2.0",           href: "https://www.khronos.org/gltf/",                external: true },
      { label: "WebGL 2",            href: "https://www.khronos.org/webgl/",               external: true },
    ],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="hp-footer">
      <div className="hp-footer-inner">
        {/* Brand column */}
        <div className="hp-footer-brand">
          <Link to="/" className="hp-footer-logo" aria-label="Objekta home">
            Objekta
          </Link>
          <p className="hp-footer-tagline">
            A browser-native 3D studio for design teams — real-time collaboration, PBR
            rendering and asset management without leaving the browser.
          </p>
          <div className="hp-footer-socials">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hp-footer-social" aria-label="GitHub">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hp-footer-social" aria-label="Twitter">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Link columns */}
        {FOOTER_LINKS.map((col) => (
          <nav key={col.heading} className="hp-footer-col" aria-label={`${col.heading} links`}>
            <h4 className="hp-footer-col-heading">{col.heading}</h4>
            <ul className="hp-footer-col-list">
              {col.links.map((l) =>
                l.external ? (
                  <li key={l.label}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="hp-footer-link">
                      {l.label}
                    </a>
                  </li>
                ) : (
                  <li key={l.label}>
                    <Link to={l.to} className="hp-footer-link">
                      {l.label}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </nav>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="hp-footer-bottom">
        <p>&copy; {year} Objekta. All rights reserved.</p>
        <p>Built on open web standards.</p>
      </div>
    </footer>
  );
}
