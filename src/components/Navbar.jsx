// src/components/Navbar.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Minimal, auth-aware Navbar:
 * - Hidden on /studio and /dashboard (no duplicates)
 * - Shows Log In / Sign Up only when user is not logged in AND not in studio/dashboard
 * - When logged in, shows Hi <name> + Dashboard + Logout (no "Open Studio")
 * - Keeps controlled/uncontrolled open state API for compatibility
 */
export default function Navbar(props) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // hide navbar entirely on these routes (studio is fullscreen, dashboard you wanted no navbar)
  const pathname = location.pathname || "";
  if (pathname.startsWith("/studio") || pathname.startsWith("/dashboard")) {
    return null;
  }

  // Controlled/uncontrolled open state (backwards-compatible)
  const controlledOpen = props.isNavOpen ?? props.isOpen;
  const controlledSet = props.onToggleNav ?? props.setIsOpen;
  const controlled = typeof controlledOpen === "boolean" && typeof controlledSet === "function";

  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlled ? controlledOpen : internalOpen;
  const setOpen = (v) => {
    if (controlled) controlledSet(v);
    else setInternalOpen(v);
  };

  // Measure navbar height at runtime and publish to CSS variable so
  // page content can reliably offset itself. This avoids hard-coded
  // assumptions and fixes clipping across DPI/zoom/browser differences.
  const navRef = useRef(null);
  useEffect(() => {
    if (!navRef.current || typeof window === "undefined") return;

    const setVar = () => {
      try {
        const h = Math.ceil(navRef.current.getBoundingClientRect().height || 0);
        document.documentElement.style.setProperty("--navbar-height", `${h}px`);
      } catch (e) {
        // ignore
      }
    };

    setVar();

    const ro = new ResizeObserver(() => setVar());
    ro.observe(navRef.current);
    window.addEventListener("resize", setVar);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", setVar);
    };
  }, []);

  const toggle = () => setOpen(!isOpen);
  const closeMenu = () => setOpen(false);

  const links = [
    { to: "/", label: "Home" },
    { to: "/about", label: "About" },
    { to: "/gallery", label: "Gallery" },
    { to: "/projects", label: "Projects" },
    { to: "/contact", label: "Contact" },
  ];

  // We intentionally do not show login/signup links in the navbar.
  // Authentication flows are surfaced inside the app (hero / studio) to avoid duplication.

  const handleLogout = () => {
    try {
      logout();
    } catch (e) {
      // ignore
    }
    closeMenu();
    navigate("/");
  };

  return (
    <nav ref={navRef} className="navbar neon-nav" aria-label="Main navigation">
      <span className="nav-glow" aria-hidden />
      <span className="nav-scan" aria-hidden />
      <div className="nav-left">
        <h1 className="nav-logo" style={{ margin: 0 }}>
          <Link to="/" onClick={closeMenu} aria-label="OBJEKTA home" style={{ textDecoration: "none" }}>
            Objekta
          </Link>
        </h1>

        <button
          className="mobile-menu-toggle"
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
          aria-controls="main-nav"
          onClick={toggle}
          title={isOpen ? "Close menu" : "Open menu"}
        >
          <span aria-hidden="true">{isOpen ? "✕" : "☰"}</span>
        </button>
      </div>

      <div className="nav-center" aria-hidden={isOpen}>
        <ul className="nav-links" role="menubar">
          {links.map((l) => (
            <li key={l.to} role="none">
              <NavLink
                to={l.to}
                onClick={closeMenu}
                className={({ isActive }) => (isActive ? "active" : "")}
                role="menuitem"
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>

      <div className="nav-right" aria-hidden={isOpen}>
        {user ? (
          <div className="nav-user" role="group" aria-label={`User menu for ${user.name ? user.name : user.email}`}>
            <span className="nav-greeting">{user.name ? `Hi, ${user.name.split(' ')[0]}` : user.email}</span>
            <Link to="/dashboard" className="nav-link-muted" onClick={closeMenu} aria-label="Open dashboard">Dashboard</Link>
            <button
              type="button"
              onClick={handleLogout}
              className="nav-logout"
              title="Logout"
              aria-label="Logout and return to home"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="nav-guest">Creators • Start in Studio</div>
        )}
      </div>

      {/* Mobile menu */}
      <div
        id="main-nav"
        className={`mobile-menu ${isOpen ? "is-open" : ""}`}
        role="menu"
        aria-hidden={!isOpen}
      >
        <ul className="nav-links-mobile" role="menu">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} onClick={closeMenu} className={({ isActive }) => (isActive ? "active" : "")}>
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="nav-right-mobile" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 1rem" }}>
          {user ? (
            <>
              <div className="mobile-greeting">{user.name ? user.name : user.email}</div>
              <Link to="/dashboard" className="nav-link-muted" onClick={closeMenu}>Dashboard</Link>
              <button onClick={handleLogout} className="nav-logout">Logout</button>
            </>
          ) : (
            <div className="mobile-guest">Creators • Start in Studio</div>
          )}
        </div>
      </div>
    </nav>
  );
}
