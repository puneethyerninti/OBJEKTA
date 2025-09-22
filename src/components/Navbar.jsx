// src/components/Navbar.jsx
import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";

/**
 * Navbar
 * Primary props:
 *   - isNavOpen (boolean)      // controlled open state
 *   - onToggleNav (function)   // controlled toggle handler
 *
 * Backwards-compatible aliases:
 *   - isOpen / setIsOpen
 *   - isNavOpen / onToggleNav
 */
export default function Navbar(props) {
  const controlledOpen = props.isNavOpen ?? props.isOpen;
  const controlledSet = props.onToggleNav ?? props.setIsOpen;
  const controlled = typeof controlledOpen === "boolean" && typeof controlledSet === "function";

  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlled ? controlledOpen : internalOpen;
  const setOpen = (v) => {
    if (controlled) controlledSet(v);
    else setInternalOpen(v);
  };

  const toggle = () => setOpen(!isOpen);
  const closeMenu = () => setOpen(false);

  const links = [
    { to: "/about", label: "About" },
    { to: "/gallery", label: "Gallery" },
    { to: "/projects", label: "Projects" },
    { to: "/contact", label: "Contact" },
  ];

  return (
    <nav className="navbar" aria-label="Main navigation">
      <div className="nav-left">
        <h1 className="nav-logo">
          <Link to="/" onClick={closeMenu}>
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
        <Link to="/login" className="nav-btn-login" onClick={closeMenu}>
          Log In
        </Link>
        <Link to="/signup" className="nav-btn-signup" onClick={closeMenu}>
          Sign Up
        </Link>
      </div>

      <div id="main-nav" className={`mobile-menu ${isOpen ? "is-open" : ""}`} role="menu" aria-hidden={!isOpen}>
        <ul className="nav-links-mobile" role="menu">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} onClick={closeMenu} className={({ isActive }) => (isActive ? "active" : "")}>
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="nav-right-mobile">
          <Link to="/login" className="nav-btn-login" onClick={closeMenu}>
            Log In
          </Link>
          <Link to="/signup" className="nav-btn-signup" onClick={closeMenu}>
            Sign Up
          </Link>
        </div>
      </div>
    </nav>
  );
}
