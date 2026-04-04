// src/components/Navbar.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Home, Info, Palette, Folder, Mail, Menu, X, Store } from 'lucide-react';
import { assetUrl } from "../utils/assets";

/**
 * Premium floating glass navbar with auth-awareness.
 * Hidden on /studio and /dashboard routes.
 */
export default function Navbar(props) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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

  // Measure navbar height and publish to CSS variable
  const navRef = useRef(null);
  useEffect(() => {
    if (!navRef.current || typeof window === "undefined") return;

    const setVar = () => {
      try {
        const h = Math.ceil(navRef.current.getBoundingClientRect().height || 0);
        document.documentElement.style.setProperty("--navbar-height", `${h}px`);
      } catch (e) { /* ignore */ }
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

  // Hide navbar on studio/dashboard routes
  const pathname = location.pathname || "";
  if (pathname.startsWith("/studio") || pathname.startsWith("/dashboard")) {
    return null;
  }

  const toggle = () => setOpen(!isOpen);
  const closeMenu = () => setOpen(false);

  const links = [
    { to: "/", label: "Home", icon: <Home size={15} />, end: true },
    { to: "/about", label: "About", icon: <Info size={15} /> },
    { to: "/gallery", label: "Gallery", icon: <Palette size={15} /> },
    { to: "/projects", label: "Projects", icon: <Folder size={15} /> },
    { to: "/contact", label: "Contact", icon: <Mail size={15} /> },
    { to: "/marketplace", label: "Marketplace", icon: <Store size={15} /> },
  ];

  const handleLogout = () => {
    try { logout(); } catch (e) { /* ignore */ }
    closeMenu();
    navigate("/");
  };

  return (
    <nav ref={navRef} className="navbar hp-nav" aria-label="Main navigation">
      <div className="nav-left">
        <h1 className="nav-logo" style={{ margin: 0 }}>
          <Link to="/" onClick={closeMenu} aria-label="OBJEKTA home" className="nav-logo-link" style={{ textDecoration: "none" }}>
            <img 
              src={assetUrl('assets/objekta-icon.svg')} 
              alt="" 
              className="nav-logo-icon" 
              aria-hidden="true"
            />
            <span className="nav-logo-text">Objekta</span>
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
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div className="nav-center" aria-hidden={isOpen}>
        <ul className="nav-links" role="menubar">
          {links.map((l) => (
            <li key={l.to} role="none">
              <NavLink
                to={l.to}
                end={l.end}
                onClick={closeMenu}
                className={({ isActive }) => (isActive ? "active" : "")}
                role="menuitem"
              >
                {l.icon}
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
          <div className="nav-guest" role="group" aria-label="Guest actions">
            <Link to="/gallery" className="nav-link-muted" onClick={closeMenu} aria-label="Open gallery">
              Explore
            </Link>
            <Link to="/login" className="nav-link-muted" onClick={closeMenu} aria-label="Start in studio">
              Start Studio
            </Link>
          </div>
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
              <NavLink to={l.to} end={l.end} onClick={closeMenu} className={({ isActive }) => (isActive ? "active" : "")}>
                {l.icon}
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
            <div className="mobile-guest" role="group" aria-label="Guest actions">
              <Link to="/gallery" className="nav-link-muted" onClick={closeMenu}>Explore Gallery</Link>
              <Link to="/login" className="nav-link-muted" onClick={closeMenu}>Start Studio</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
