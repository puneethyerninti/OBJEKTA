// src/components/SnapIndicator.jsx
// Visual indicator for smart snap targets (vertex, edge, center)
import React, { useEffect, useState, useRef } from "react";
import EventBus from "../utils/EventBus";
import * as SnapManager from "../engine/SnapManager";

const SNAP_COLORS = {
  vertex: "#00ff88",
  edge: "#00aaff",
  center: "#ffaa00",
  face: "#ff00aa",
};

const SNAP_LABELS = {
  vertex: "Vertex",
  edge: "Edge",
  center: "Center",
  face: "Face",
};

/**
 * SnapIndicator component shows visual feedback when snapping to geometry.
 * Renders a floating indicator at the snap position with type label.
 */
export default function SnapIndicator({ camera, renderer }) {
  const [indicator, setIndicator] = useState(null);
  const [screenPos, setScreenPos] = useState({ x: 0, y: 0 });
  const animFrameRef = useRef(null);

  // Subscribe to snap indicator events
  useEffect(() => {
    const handleSnapIndicator = (data) => {
      if (!data || !data.show) {
        setIndicator(null);
        return;
      }
      
      if (!SnapManager.isShowIndicators()) {
        setIndicator(null);
        return;
      }

      setIndicator({
        type: data.type,
        position: data.position,
      });
    };

    EventBus.on("snap:indicator", handleSnapIndicator);
    return () => {
      EventBus.off("snap:indicator", handleSnapIndicator);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Update screen position when indicator changes
  useEffect(() => {
    if (!indicator || !camera || !renderer) {
      return;
    }

    const updateScreenPosition = () => {
      if (!indicator.position) return;

      // Project 3D position to screen space
      const vector = indicator.position.clone();
      vector.project(camera);

      const canvas = renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      
      const x = (vector.x * 0.5 + 0.5) * rect.width + rect.left;
      const y = (-vector.y * 0.5 + 0.5) * rect.height + rect.top;

      setScreenPos({ x, y });
      animFrameRef.current = requestAnimationFrame(updateScreenPosition);
    };

    updateScreenPosition();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [indicator, camera, renderer]);

  if (!indicator) return null;

  const color = SNAP_COLORS[indicator.type] || "#ffffff";
  const label = SNAP_LABELS[indicator.type] || indicator.type;

  return (
    <div
      style={{
        position: "fixed",
        left: screenPos.x,
        top: screenPos.y,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 10000,
      }}
    >
      {/* Outer glow ring */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
          animation: "snapPulse 0.5s ease-out infinite",
        }}
      />
      
      {/* Inner dot */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 8px ${color}, 0 0 16px ${color}40`,
        }}
      />

      {/* Label */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 16,
          transform: "translateX(-50%)",
          background: "rgba(0, 0, 0, 0.8)",
          color: color,
          padding: "2px 6px",
          borderRadius: 3,
          fontSize: 9,
          fontWeight: 600,
          whiteSpace: "nowrap",
          border: `1px solid ${color}60`,
        }}
      >
        {label}
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes snapPulse {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
