// src/components/MaterialEditor.jsx
import * as THREE from "three";
import EventBus from "../utils/EventBus";

/**
 * createMaterialEditor({ container, getSelectedMesh })
 * - container: DOM element to attach the UI (will append a small panel)
 * - getSelectedMesh: function() => THREE.Mesh (current selected mesh)
 *
 * Returns { dispose, refresh }
 *
 * Usage: call refresh() when selection changes.
 */
export function createMaterialEditor({ container, getSelectedMesh }) {
  if (!container) throw new Error("container required");

  const panel = document.createElement("div");
  panel.style.position = "absolute";
  panel.style.right = "12px";
  panel.style.bottom = "12px";
  panel.style.width = "260px";
  panel.style.maxHeight = "60vh";
  panel.style.overflowY = "auto";
  panel.style.background = "rgba(0,0,0,0.6)";
  panel.style.color = "#fff";
  panel.style.padding = "12px";
  panel.style.borderRadius = "8px";
  panel.style.fontFamily = "system-ui, sans-serif";
  panel.style.fontSize = "13px";
  panel.style.zIndex = 9999;
  const title = document.createElement("strong");
  title.style.display = "block";
  title.style.marginBottom = "8px";
  title.textContent = "Material Editor";
  const body = document.createElement("div");
  body.id = "material-body";
  panel.appendChild(title);
  panel.appendChild(body);
  panel.style.display = "none";

  container.style.position = container.style.position || "relative";
  container.appendChild(panel);

  // Track blob URLs for cleanup
  const blobUrls = new Set();

  function _makeInput(labelText, type = "range", props = {}) {
    const wrap = document.createElement("div");
    wrap.style.marginBottom = "8px";
    const label = document.createElement("label");
    label.textContent = labelText;
    label.style.display = "block";
    label.style.marginBottom = "4px";
    wrap.appendChild(label);

    let input;
    if (type === "color") {
      input = document.createElement("input");
      input.type = "color";
      input.value = props.value || "#ffffff";
    } else if (type === "file") {
      input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
    } else if (type === "checkbox") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!props.checked;
    } else {
      input = document.createElement("input");
      input.type = type;
      if (props.min !== undefined) input.min = props.min;
      if (props.max !== undefined) input.max = props.max;
      if (props.step !== undefined) input.step = props.step;
      if (props.value !== undefined) input.value = props.value;
    }
    input.style.width = "100%";
    wrap.appendChild(input);
    return { wrap, input };
  }

  function _makeTextureUpload(labelText, targetMat, mapKey) {
    const { wrap, input } = _makeInput(labelText, "file");
    const status = document.createElement("span");
    status.style.fontSize = "11px";
    status.style.opacity = "0.6";
    status.textContent = targetMat[mapKey] ? "(loaded)" : "";
    wrap.appendChild(status);

    input.addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      blobUrls.add(url);
      const tex = new THREE.TextureLoader().load(url, () => {
        targetMat[mapKey] = tex;
        targetMat.needsUpdate = true;
        status.textContent = "(loaded)";
      });
    });

    if (targetMat[mapKey]) {
      const clearBtn = document.createElement("button");
      clearBtn.textContent = "Clear";
      clearBtn.style.fontSize = "10px";
      clearBtn.style.marginLeft = "8px";
      clearBtn.onclick = () => {
        targetMat[mapKey] = null;
        targetMat.needsUpdate = true;
        status.textContent = "";
        clearBtn.remove();
      };
      wrap.appendChild(clearBtn);
    }

    return wrap;
  }

  let currentMesh = null;

  function refresh() {
    const body = panel.querySelector("#material-body");
    while (body.firstChild) body.removeChild(body.firstChild);

    // Revoke old blob URLs
    for (const url of blobUrls) { try { URL.revokeObjectURL(url); } catch (e) {} }
    blobUrls.clear();

    currentMesh = getSelectedMesh && getSelectedMesh();
    if (!currentMesh || !currentMesh.material) {
      panel.style.display = "none";
      return;
    }

    panel.style.display = "block";

    const mat = currentMesh.material;
    const targetMat = Array.isArray(mat) ? mat[0] : mat;

    // Base Color
    const { wrap: colorWrap, input: colorInput } = _makeInput("Base Color", "color", { value: "#ffffff" });
    colorInput.value = "#" + (targetMat.color?.getHexString() ?? "ffffff");
    colorInput.addEventListener("input", () => {
      targetMat.color.set(colorInput.value);
      targetMat.needsUpdate = true;
    });
    body.appendChild(colorWrap);

    // Roughness
    const { wrap: roughWrap, input: roughInput } = _makeInput("Roughness", "range", { min: 0, max: 1, step: 0.01, value: targetMat.roughness ?? 0.5 });
    roughInput.value = targetMat.roughness ?? 0.5;
    roughInput.addEventListener("input", () => {
      targetMat.roughness = parseFloat(roughInput.value);
      targetMat.needsUpdate = true;
    });
    body.appendChild(roughWrap);

    // Metalness
    const { wrap: metalWrap, input: metalInput } = _makeInput("Metalness", "range", { min: 0, max: 1, step: 0.01, value: targetMat.metalness ?? 0.0 });
    metalInput.value = targetMat.metalness ?? 0;
    metalInput.addEventListener("input", () => {
      targetMat.metalness = parseFloat(metalInput.value);
      targetMat.needsUpdate = true;
    });
    body.appendChild(metalWrap);

    // Emissive Color
    if (targetMat.emissive !== undefined) {
      const { wrap: emWrap, input: emInput } = _makeInput("Emissive Color", "color", { value: "#000000" });
      emInput.value = "#" + (targetMat.emissive?.getHexString() ?? "000000");
      emInput.addEventListener("input", () => {
        targetMat.emissive.set(emInput.value);
        targetMat.needsUpdate = true;
      });
      body.appendChild(emWrap);

      const { wrap: emIntWrap, input: emIntInput } = _makeInput("Emissive Intensity", "range", { min: 0, max: 5, step: 0.1, value: targetMat.emissiveIntensity ?? 1 });
      emIntInput.value = targetMat.emissiveIntensity ?? 1;
      emIntInput.addEventListener("input", () => {
        targetMat.emissiveIntensity = parseFloat(emIntInput.value);
        targetMat.needsUpdate = true;
      });
      body.appendChild(emIntWrap);
    }

    // Section header for texture maps
    const texHeader = document.createElement("div");
    texHeader.style.marginTop = "8px";
    texHeader.style.marginBottom = "4px";
    texHeader.style.fontWeight = "600";
    texHeader.style.fontSize = "12px";
    texHeader.style.borderTop = "1px solid rgba(255,255,255,0.15)";
    texHeader.style.paddingTop = "8px";
    texHeader.textContent = "Texture Maps";
    body.appendChild(texHeader);

    // Albedo Map
    body.appendChild(_makeTextureUpload("Albedo Map", targetMat, "map"));
    // Normal Map
    body.appendChild(_makeTextureUpload("Normal Map", targetMat, "normalMap"));
    // Roughness Map
    body.appendChild(_makeTextureUpload("Roughness Map", targetMat, "roughnessMap"));
    // Metalness Map
    body.appendChild(_makeTextureUpload("Metalness Map", targetMat, "metalnessMap"));
    // AO Map
    body.appendChild(_makeTextureUpload("AO Map", targetMat, "aoMap"));
    // Emissive Map
    body.appendChild(_makeTextureUpload("Emissive Map", targetMat, "emissiveMap"));

    // Reset button
    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset material";
    resetBtn.style.marginTop = "8px";
    resetBtn.onclick = () => {
      const prevColor = targetMat.color ? targetMat.color.clone() : null;
      const newMat = new THREE.MeshStandardMaterial({ color: prevColor || new THREE.Color(0xffffff) });
      if (Array.isArray(currentMesh.material)) currentMesh.material[0] = newMat;
      else currentMesh.material = newMat;
      refresh();
    };
    body.appendChild(resetBtn);
  }

  // Subscribe to EventBus for auto-refresh on selection/scene changes
  const onSelected = () => { try { refresh(); } catch (e) {} };
  EventBus.on("object:selected", onSelected);
  EventBus.on("scene:updated", onSelected);

  function dispose() {
    EventBus.off("object:selected", onSelected);
    EventBus.off("scene:updated", onSelected);
    for (const url of blobUrls) { try { URL.revokeObjectURL(url); } catch (e) {} }
    blobUrls.clear();
    try { panel.remove(); } catch (e) {}
  }

  return { dispose, refresh };
}

export default createMaterialEditor;
