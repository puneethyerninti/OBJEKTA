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
      { label: "Three.js",        href: "https://threejs.org",              external: true },
      { label: "React Three Fiber", href: "https://docs.pmnd.rs/react-three-fiber", external: true },
      { label: "glTF 2.0",        href: "https://www.khronos.org/gltf/",   external: true },
      { label: "WebGL 2",         href: "https://www.khronos.org/webgl/",  external: true },
    ],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer-full">
      <div className="footer-inner">
        {/* Brand column */}
        <div className="footer-brand">
          <Link to="/" className="footer-logo" aria-label="Objekta home">
            Objekta
          </Link>
          <p className="footer-tagline">
            A browser-native 3D studio for design teams — real-time collaboration, PBR rendering
            and asset management without leaving the browser.
          </p>
        </div>

        {/* Link columns */}
        {FOOTER_LINKS.map((col) => (
          <nav key={col.heading} className="footer-col" aria-label={`${col.heading} links`}>
            <h4 className="footer-col-heading">{col.heading}</h4>
            <ul className="footer-col-list">
              {col.links.map((l) =>
                l.external ? (
                  <li key={l.label}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="footer-link">
                      {l.label}
                    </a>
                  </li>
                ) : (
                  <li key={l.label}>
                    <Link to={l.to} className="footer-link">
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
      <div className="footer-bottom">
        <p>© {year} Objekta. All rights reserved.</p>
        <p>Built on open web standards.</p>
      </div>
    </footer>
  );
}
