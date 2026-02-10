import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./patchThreeChunks";

// Surface API base for runtime overrides; safe to read Vite envs inside module context
if (typeof window !== "undefined") {
  window.__OBJEKTA_API_BASE = window.__OBJEKTA_API_BASE
    || import.meta.env.VITE_API_BASE
    || import.meta.env.VITE_API_URL;
}

// Ensure touch/wheel listeners remain cancelable when we need preventDefault
// (Chrome may default some listeners to passive=true).
(() => {
  try {
    const origAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const forceNonPassive = type === "touchstart" || type === "touchmove" || type === "wheel";
      if (forceNonPassive) {
        // Always disable passive so preventDefault is honored; avoids React warnings when gestures block scroll.
        if (!options || options === true || options === false) {
          return origAdd.call(this, type, listener, { passive: false });
        }
        if (typeof options === "object") {
          return origAdd.call(this, type, listener, { ...options, passive: false });
        }
      }
      return origAdd.call(this, type, listener, options);
    };
  } catch (e) {}
})();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
