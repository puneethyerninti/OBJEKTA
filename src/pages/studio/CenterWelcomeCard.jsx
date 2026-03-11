// src/pages/studio/CenterWelcomeCard.jsx
import React from "react";
import { FiRefreshCcw, FiCamera } from "react-icons/fi";

/**
 * Floating welcome / quick-action card shown in the centre of the viewport
 * when the user first enters the studio or when the scene is empty.
 *
 * Stable identity — defined outside Studio to avoid re-mount on re-render.
 */
const CenterWelcomeCard = React.memo(function CenterWelcomeCard({
  workspaceRef,
  pushToast,
  captureThumbnailAsync,
  importGLTF,
}) {
  const sceneSummary = workspaceRef.current?.getSceneSummary?.();

  return (
    <div className="welcome-card reveal welcome-card--positioned">
      <div className="welcome-card__header">
        <div className="welcome-card__title">Welcome to Objekta</div>
        <div className="welcome-card__icon-group">
          <button
            className="studio-btn icon-btn"
            onClick={() => {
              workspaceRef.current?.resetScene?.();
              pushToast({ type: "info", message: "Reset scene" });
            }}
            title="Reset scene"
            aria-label="Reset scene"
          >
            <FiRefreshCcw />
          </button>
          <button
            className="studio-btn icon-btn"
            onClick={() => {
              (async () => {
                const url = await captureThumbnailAsync();
                if (url) {
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "thumbnail.jpg";
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                } else {
                  pushToast({
                    type: "error",
                    message: "Screenshot failed — no canvas available",
                  });
                }
              })();
            }}
            title="Screenshot"
            aria-label="Screenshot"
          >
            <FiCamera />
          </button>
        </div>
      </div>

      <div className="welcome-card__desc">
        Use the palette (left) to add primitives and lights, or drag-and-drop a
        GLB into the viewport.
      </div>

      <div className="welcome-card__quick-actions">
        <button
          className="launch-btn"
          onClick={() => {
            workspaceRef.current?.addItem?.("Cube");
            pushToast({ type: "info", message: "Cube added" });
          }}
        >
          Add Cube
        </button>
        <button
          className="studio-btn"
          onClick={() => {
            workspaceRef.current?.addItem?.("Sphere");
            pushToast({ type: "info", message: "Sphere added" });
          }}
        >
          Add Sphere
        </button>
        <label className="welcome-card__import-label">
          <input
            aria-label="Import GLB"
            type="file"
            accept=".glb,.gltf,.obj,.fbx,.zip"
            className="sr-only"
            onChange={(e) => importGLTF(e.target.files?.[0])}
          />
          <button className="studio-btn">Import GLB</button>
        </label>
      </div>

      <div className="welcome-card__scene-info">
        <div className="panel-title">Scene</div>
        <div className="panel-empty">
          {sceneSummary
            ? `${sceneSummary.objects} objects · ${sceneSummary.totalTris} tris`
            : "No objects yet"}
        </div>
      </div>
    </div>
  );
});

export default CenterWelcomeCard;
