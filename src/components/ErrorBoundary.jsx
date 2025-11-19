import React from "react";

// Neutralized ErrorBoundary: passthrough to avoid interfering with canvas/effects
export default function ErrorBoundary({ children }) {
  return children;
}
