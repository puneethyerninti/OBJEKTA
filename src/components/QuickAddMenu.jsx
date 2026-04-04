// src/components/QuickAddMenu.jsx
// Shift+A quick add menu for primitives, lights, cameras - inspired by Blender
import React, { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import EventBus from "../utils/EventBus";

const ACCENT = "#7f5af0";

// Primitive mesh types
const MESH_PRIMITIVES = [
  { id: "cube", label: "Cube", icon: "▣", geometry: () => new THREE.BoxGeometry(1, 1, 1) },
  { id: "sphere", label: "Sphere", icon: "●", geometry: () => new THREE.SphereGeometry(0.5, 32, 16) },
  { id: "cylinder", label: "Cylinder", icon: "◯", geometry: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 32) },
  { id: "cone", label: "Cone", icon: "△", geometry: () => new THREE.ConeGeometry(0.5, 1, 32) },
  { id: "plane", label: "Plane", icon: "▭", geometry: () => new THREE.PlaneGeometry(2, 2) },
  { id: "torus", label: "Torus", icon: "◎", geometry: () => new THREE.TorusGeometry(0.5, 0.2, 16, 48) },
  { id: "torusKnot", label: "Torus Knot", icon: "∞", geometry: () => new THREE.TorusKnotGeometry(0.4, 0.15, 100, 16) },
  { id: "icosahedron", label: "Icosahedron", icon: "⬡", geometry: () => new THREE.IcosahedronGeometry(0.5) },
  { id: "dodecahedron", label: "Dodecahedron", icon: "⎔", geometry: () => new THREE.DodecahedronGeometry(0.5) },
  { id: "octahedron", label: "Octahedron", icon: "◇", geometry: () => new THREE.OctahedronGeometry(0.5) },
  { id: "tetrahedron", label: "Tetrahedron", icon: "▲", geometry: () => new THREE.TetrahedronGeometry(0.5) },
  { id: "ring", label: "Ring", icon: "◌", geometry: () => new THREE.RingGeometry(0.3, 0.5, 32) },
  { id: "capsule", label: "Capsule", icon: "⬭", geometry: () => new THREE.CapsuleGeometry(0.25, 0.5, 4, 16) },
];

// Light types
const LIGHT_TYPES = [
  { id: "point", label: "Point Light", icon: "💡", create: () => {
    const light = new THREE.PointLight(0xffffff, 1, 100);
    light.name = "Point Light";
    return light;
  }},
  { id: "directional", label: "Directional Light", icon: "☀", create: () => {
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.name = "Directional Light";
    light.castShadow = true;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    return light;
  }},
  { id: "spot", label: "Spot Light", icon: "🔦", create: () => {
    const light = new THREE.SpotLight(0xffffff, 1, 100, Math.PI / 6, 0.5, 1);
    light.name = "Spot Light";
    light.castShadow = true;
    return light;
  }},
  { id: "hemisphere", label: "Hemisphere Light", icon: "🌤", create: () => {
    const light = new THREE.HemisphereLight(0x87ceeb, 0x8b4513, 0.6);
    light.name = "Hemisphere Light";
    return light;
  }},
  { id: "ambient", label: "Ambient Light", icon: "🌫", create: () => {
    const light = new THREE.AmbientLight(0x404040, 0.5);
    light.name = "Ambient Light";
    return light;
  }},
  { id: "rectarea", label: "Area Light", icon: "▢", create: () => {
    const light = new THREE.RectAreaLight(0xffffff, 1, 2, 2);
    light.name = "Area Light";
    return light;
  }},
];

// Camera types
const CAMERA_TYPES = [
  { id: "perspective", label: "Perspective Camera", icon: "📷", create: () => {
    const camera = new THREE.PerspectiveCamera(50, 16/9, 0.1, 1000);
    camera.name = "Camera";
    return camera;
  }},
  { id: "orthographic", label: "Orthographic Camera", icon: "📐", create: () => {
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000);
    camera.name = "Ortho Camera";
    return camera;
  }},
];

// Empty/helper types
const EMPTY_TYPES = [
  { id: "empty", label: "Empty (Group)", icon: "⊡", create: () => {
    const group = new THREE.Group();
    group.name = "Empty";
    return group;
  }},
  { id: "axesHelper", label: "Axes Helper", icon: "✛", create: () => {
    const helper = new THREE.AxesHelper(1);
    helper.name = "Axes Helper";
    return helper;
  }},
  { id: "gridHelper", label: "Grid Helper", icon: "⊞", create: () => {
    const helper = new THREE.GridHelper(10, 10);
    helper.name = "Grid Helper";
    return helper;
  }},
];

// Menu categories
const CATEGORIES = [
  { id: "mesh", label: "Mesh", items: MESH_PRIMITIVES, defaultMaterial: true },
  { id: "light", label: "Light", items: LIGHT_TYPES },
  { id: "camera", label: "Camera", items: CAMERA_TYPES },
  { id: "empty", label: "Empty", items: EMPTY_TYPES },
];

export default function QuickAddMenu({ workspaceRef, onClose }) {
  const [activeCategory, setActiveCategory] = useState("mesh");
  const [searchTerm, setSearchTerm] = useState("");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef(null);
  const searchRef = useRef(null);

  // Position menu at center or cursor
  useEffect(() => {
    const x = (window.innerWidth - 320) / 2;
    const y = (window.innerHeight - 400) / 2;
    setPosition({ x: Math.max(20, x), y: Math.max(60, y) });
    
    // Focus search input
    setTimeout(() => searchRef.current?.focus(), 50);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Add object to scene
  const addObject = useCallback((item, category) => {
    try {
      const ws = workspaceRef?.current;
      if (!ws) {
        console.warn("QuickAddMenu: No workspace ref");
        onClose?.();
        return;
      }

      let object;

      if (category.defaultMaterial && item.geometry) {
        // Create mesh with default material
        const geometry = item.geometry();
        const material = new THREE.MeshStandardMaterial({
          color: 0x888888,
          roughness: 0.5,
          metalness: 0.0,
        });
        object = new THREE.Mesh(geometry, material);
        object.name = item.label;
        object.castShadow = true;
        object.receiveShadow = true;
      } else if (item.create) {
        object = item.create();
      }

      if (!object) {
        onClose?.();
        return;
      }

      // Position at camera target or origin
      try {
        const target = ws.getCameraControlsApi?.()?.controls?.target;
        if (target) {
          object.position.copy(target);
        }
      } catch (e) {
        object.position.set(0, 0, 0);
      }

      // Add to scene via workspace API
      if (ws.addObject) {
        ws.addObject(object);
      } else if (ws.scene) {
        // Fallback: add directly to user group or scene
        const userGroup = ws.scene.getObjectByName("__userGroup") || ws.scene;
        userGroup.add(object);
      }

      // Select the new object
      if (ws.selectObject) {
        ws.selectObject(object);
      }

      // Emit event
      EventBus?.emit?.("object:added", { object, type: item.id, category: category.id });

      onClose?.();
    } catch (e) {
      console.error("QuickAddMenu: Failed to add object", e);
      onClose?.();
    }
  }, [workspaceRef, onClose]);

  // Filter items by search
  const getFilteredItems = useCallback((items) => {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(term));
  }, [searchTerm]);

  // Get all items for search across categories
  const getAllFilteredItems = useCallback(() => {
    if (!searchTerm) return null;
    const results = [];
    CATEGORIES.forEach((cat) => {
      getFilteredItems(cat.items).forEach((item) => {
        results.push({ item, category: cat });
      });
    });
    return results;
  }, [searchTerm, getFilteredItems]);

  const currentCategory = CATEGORIES.find((c) => c.id === activeCategory);
  const allResults = getAllFilteredItems();

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        width: 320,
        maxHeight: 450,
        background: "rgba(26, 32, 44, 0.98)",
        border: "1px solid #2d3748",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        backdropFilter: "blur(12px)",
        zIndex: 10000,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #2d3748",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontWeight: 600, color: "#e2e8f0", fontSize: 14 }}>
          Add Object
        </span>
        <span style={{ fontSize: 10, color: "#718096" }}>Shift+A</span>
      </div>

      {/* Search */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #2d3748" }}>
        <input
          ref={searchRef}
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            background: "rgba(0,0,0,0.3)",
            border: "1px solid #4a5568",
            borderRadius: 6,
            padding: "8px 12px",
            color: "#e2e8f0",
            fontSize: 12,
            outline: "none",
          }}
        />
      </div>

      {/* Category tabs (hidden when searching) */}
      {!searchTerm && (
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #2d3748",
            background: "rgba(0,0,0,0.2)",
          }}
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                flex: 1,
                padding: "8px",
                background: activeCategory === cat.id ? "rgba(127, 90, 240, 0.2)" : "transparent",
                border: "none",
                borderBottom: activeCategory === cat.id ? `2px solid ${ACCENT}` : "2px solid transparent",
                color: activeCategory === cat.id ? "#e2e8f0" : "#a0aec0",
                fontSize: 11,
                fontWeight: activeCategory === cat.id ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Items list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px",
        }}
      >
        {searchTerm && allResults ? (
          // Show all matching items across categories
          allResults.length > 0 ? (
            allResults.map(({ item, category }, idx) => (
              <button
                key={`${category.id}-${item.id}-${idx}`}
                onClick={() => addObject(item, category)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  background: "transparent",
                  border: "none",
                  borderRadius: 6,
                  color: "#e2e8f0",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(127, 90, 240, 0.15)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: "#718096" }}>{category.label}</div>
                </div>
              </button>
            ))
          ) : (
            <div style={{ padding: 20, textAlign: "center", color: "#718096", fontSize: 12 }}>
              No results found
            </div>
          )
        ) : (
          // Show items for current category
          getFilteredItems(currentCategory?.items || []).map((item) => (
            <button
              key={item.id}
              onClick={() => addObject(item, currentCategory)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                background: "transparent",
                border: "none",
                borderRadius: 6,
                color: "#e2e8f0",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(127, 90, 240, 0.15)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{item.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{item.label}</span>
            </button>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div
        style={{
          padding: "8px 12px",
          borderTop: "1px solid #2d3748",
          fontSize: 10,
          color: "#718096",
          textAlign: "center",
        }}
      >
        Click to add • Esc to close
      </div>
    </div>
  );
}
