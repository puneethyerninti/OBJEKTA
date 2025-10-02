// src/components/MaterialEditor.jsx
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
  panel.innerHTML = `<strong style="display:block;margin-bottom:8px">Material Editor</strong><div id="material-body">No selection</div>`;

  container.style.position = container.style.position || "relative";
  container.appendChild(panel);

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

  let currentMesh = null;

  function refresh() {
    const body = panel.querySelector("#material-body");
    while (body.firstChild) body.removeChild(body.firstChild);

    currentMesh = getSelectedMesh && getSelectedMesh();
    if (!currentMesh || !currentMesh.material) {
      body.textContent = "No selection";
      return;
    }

    const mat = currentMesh.material;
    // If array, pick first for editing (simple version)
    const targetMat = Array.isArray(mat) ? mat[0] : mat;

    // Color
    const { wrap: colorWrap, input: colorInput } = _makeInput("Base Color", "color", { value: "#ffffff" });
    colorInput.value = "#" + targetMat.color.getHexString();
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

    // Map uploader
    const { wrap: fileWrap, input: fileInput } = _makeInput("Albedo Map (optional)", "file");
    fileInput.addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      const tex = new THREE.TextureLoader().load(url, () => {
        targetMat.map = tex;
        targetMat.needsUpdate = true;
        try { URL.revokeObjectURL(url); } catch (e) {}
      });
    });
    body.appendChild(fileWrap);

    // Reset button
    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset material";
    resetBtn.style.marginTop = "8px";
    resetBtn.onclick = () => {
      // naive reset: recreate standard material preserving color
      const prevColor = targetMat.color ? targetMat.color.clone() : null;
      const newMat = new THREE.MeshStandardMaterial({ color: prevColor || new THREE.Color(0xffffff) });
      if (Array.isArray(currentMesh.material)) currentMesh.material[0] = newMat;
      else currentMesh.material = newMat;
      refresh();
    };
    body.appendChild(resetBtn);
  }

  function dispose() {
    try { panel.remove(); } catch (e) {}
  }

  return { dispose, refresh };
}

export default createMaterialEditor;
