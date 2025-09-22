// src/components/Footer.jsx
import React from "react"; // <-- Add React import

export default function Footer() {
  return (
    <footer className="footer">
      <p>© {new Date().getFullYear()} Objekta. All rights reserved.</p>
    </footer>
  );
}
