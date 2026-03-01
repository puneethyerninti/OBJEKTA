// src/engine/AISceneAnalyzer.js
// ---------------------------------------------------------------------------
// High-level AI features that operate on the 3D scene.
//
// Architecture: **LLM-first with rule-based fallback**.
// 1. Every public function first tries the backend LLM proxy (Groq / Gemini /
//    OpenAI / Claude — whichever is configured).
// 2. If the backend is unavailable or errors, falls back to the local
//    rule-based + template system for instant, deterministic results.
//
// This gives ChatGPT / Claude quality when a provider is configured, and
// still works fully offline / without API keys via the fallback.
// ---------------------------------------------------------------------------

import { AIStore } from "../store/AIStore";
import {
  summarizeObject,
  collectLights,
  computeSceneSummary,
} from "../components/workspace/sceneSerializer";
import {
  aiDescribeScene,
  aiChat,
  aiSuggestMaterial,
  aiSuggestNames,
  getAIStatus,
} from "../services/aiService";

// Cache whether backend AI is available (refreshed on first call)
let _aiAvailable = null;
async function isAIAvailable() {
  if (_aiAvailable !== null) return _aiAvailable;
  try {
    const status = await getAIStatus();
    _aiAvailable = status.configured === true;
  } catch {
    _aiAvailable = false;
  }
  // Re-check every 60s in case user configures keys later
  setTimeout(() => { _aiAvailable = null; }, 60000);
  return _aiAvailable;
}

// ── Helpers ───────────────────────────────────────────────────────────
function fmt(n) {
  return typeof n === "number" ? n.toFixed(2) : "?";
}
function formatNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(Math.round(n));
}
function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}
function friendlyType(type) {
  const map = {
    Mesh: "mesh", Group: "group", Object3D: "object",
    PointLight: "point light", DirectionalLight: "directional light",
    SpotLight: "spotlight", AmbientLight: "ambient light",
    HemisphereLight: "hemisphere light", RectAreaLight: "area light",
  };
  return map[type] || type || "object";
}

// ── Color classification ──────────────────────────────────────────────
function classifyColor(hex) {
  if (!hex) return "default-colored";
  const h = hex.toLowerCase();
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  if (isNaN(r)) return "colored";
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max - min < 0.08) return l > 0.85 ? "white" : l < 0.15 ? "black" : "gray";
  let hue = 0;
  if (max === r) hue = ((g - b) / (max - min)) % 6;
  else if (max === g) hue = (b - r) / (max - min) + 2;
  else hue = (r - g) / (max - min) + 4;
  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;
  if (hue < 15 || hue >= 345) return "red";
  if (hue < 45) return "orange";
  if (hue < 70) return "yellow";
  if (hue < 160) return "green";
  if (hue < 200) return "cyan";
  if (hue < 260) return "blue";
  if (hue < 310) return "purple";
  return "pink";
}

// ── Material classification ───────────────────────────────────────────
function classifyMaterial(obj) {
  const rough = obj.material?.roughness;
  const metal = obj.material?.metalness;
  if (metal != null && metal > 0.7) {
    return rough != null && rough < 0.3 ? "polished metal" : "brushed metal";
  }
  if (rough != null) {
    if (rough < 0.15) return "glossy";
    if (rough < 0.4) return "semi-glossy";
    if (rough > 0.8) return "matte";
  }
  return "standard";
}

// ── Shape classification ──────────────────────────────────────────────
function classifyShape(obj) {
  const geomType = (obj.geometry?.type || "").toLowerCase();
  if (geomType.includes("box") || geomType.includes("cube")) return "box";
  if (geomType.includes("sphere")) return "sphere";
  if (geomType.includes("cone")) return "cone";
  if (geomType.includes("cylinder")) return "cylinder";
  if (geomType.includes("torus")) return "torus";
  if (geomType.includes("plane")) return "plane";
  if (geomType.includes("circle")) return "disc";
  if (geomType.includes("ring")) return "ring";
  const tris = obj.geometry?.tris || 0;
  if (tris < 20) return "low-poly primitive";
  if (tris < 500) return "simple model";
  if (tris < 5000) return "detailed model";
  return "high-detail model";
}

// ── Object description builder ────────────────────────────────────────
function describeObject(obj) {
  const name = obj.name || "unnamed object";
  const color = classifyColor(obj.material?.color);
  const surface = classifyMaterial(obj);
  const shape = classifyShape(obj);
  const tris = obj.geometry?.tris || 0;
  return { name, color, surface, shape, tris };
}

// ── Scene context builder (for LLM) ──────────────────────────────────
function buildSceneContext(sceneChildren, scene) {
  const serialized = sceneChildren.map(summarizeObject);
  const lights = scene ? collectLights(scene) : [];
  const summary = computeSceneSummary(sceneChildren);
  const described = serialized.map(describeObject);

  const lines = [];
  lines.push(`Objects: ${summary.objects} | Triangles: ${summary.totalTris} | Lights: ${lights.length}`);
  lines.push("");
  for (const d of described.slice(0, 20)) {
    lines.push(`- "${d.name}" — ${d.color} ${d.surface} ${d.shape}, ${d.tris} tris`);
  }
  if (described.length > 20) lines.push(`  …and ${described.length - 20} more objects`);

  if (lights.length > 0) {
    lines.push("");
    lines.push("Lights:");
    for (const l of lights.slice(0, 10)) {
      lines.push(`- ${l.type} "${l.name || "unnamed"}" intensity=${l.intensity} color=${l.color}`);
    }
  }

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate an accurate description of the current scene.
 * Tries LLM first, falls back to rule-based.
 */
export async function describeScene(sceneChildren, scene) {
  const store = AIStore.getState();
  store.setStatus("loading", "Analyzing scene…");

  try {
    const serialized = sceneChildren.map(summarizeObject);
    const lights = scene ? collectLights(scene) : [];
    const summary = computeSceneSummary(sceneChildren);

    if (serialized.length === 0) {
      const text = "The scene is currently empty. Add objects from the palette or import a GLB/glTF model to get started.";
      store.setResult("sceneDescription", text);
      store.setStatus("ready", "Done");
      return text;
    }

    // ── Try LLM ──────────────────────────────────────────────────────
    if (await isAIAvailable()) {
      try {
        const ctx = buildSceneContext(sceneChildren, scene);
        const result = await aiDescribeScene(ctx);
        if (result.text) {
          store.setResult("sceneDescription", result.text);
          store.setStatus("ready", `via ${result.provider}`);
          return result.text;
        }
      } catch (llmErr) {
        console.warn("[AI] LLM describe failed, using fallback:", llmErr.message);
      }
    }

    // ── Rule-based fallback (enhanced) ─────────────────────────────────
    const described = serialized.map(describeObject);
    const groups = {};
    for (const d of described) {
      const key = d.shape;
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    }

    const parts = [];

    // ── Opening: Scene overview with character ───────────────────────
    const trisBudget = summary.totalTris < 5000 ? "lightweight" : summary.totalTris < 50000 ? "mid-weight" : summary.totalTris < 500000 ? "detailed" : "heavy";
    parts.push(
      `**Scene Overview** — ${summary.objects} object${summary.objects !== 1 ? "s" : ""}, ` +
      `${formatNum(summary.totalTris)} triangles (${trisBudget} for real-time rendering).`
    );

    // ── Objects: Natural prose per item (up to 6) ────────────────────
    const objLines = [];
    // Sort by triangle count descending so hero objects come first
    const sorted = [...described].sort((a, b) => b.tris - a.tris);
    for (const d of sorted.slice(0, 6)) {
      const nameTag = d.name !== "unnamed object" ? `**${d.name}**` : "an unnamed object";
      const triNote = d.tris === 0 ? " (empty geometry)" : ` — ${formatNum(d.tris)} tris`;
      // Build a natural phrase
      if (d.shape === "sphere") {
        objLines.push(`• ${nameTag}: a smooth ${d.color} ${d.surface} sphere${triNote}`);
      } else if (d.shape === "box") {
        objLines.push(`• ${nameTag}: a ${d.color} ${d.surface === "standard" ? "" : d.surface + " "}cube${triNote}`);
      } else if (d.shape === "plane") {
        objLines.push(`• ${nameTag}: a ${d.color} flat plane, likely a ground surface${triNote}`);
      } else if (d.shape === "cylinder" || d.shape === "cone" || d.shape === "torus") {
        objLines.push(`• ${nameTag}: a ${d.color} ${d.surface} ${d.shape}${triNote}`);
      } else {
        // imported / complex model
        objLines.push(`• ${nameTag}: ${d.color} ${d.surface} ${d.shape}${triNote}`);
      }
    }
    if (sorted.length > 6) {
      objLines.push(`• …and ${sorted.length - 6} more object${sorted.length - 6 > 1 ? "s" : ""}.`);
    }
    if (objLines.length > 0) {
      parts.push("\n**Objects:**\n" + objLines.join("\n"));
    }

    // ── Lighting: descriptive summary ────────────────────────────────
    if (lights.length > 0) {
      const lightTypes = {};
      for (const l of lights) { lightTypes[l.type] = (lightTypes[l.type] || 0) + 1; }
      const lightParts = Object.entries(lightTypes).map(([type, count]) => {
        const friendly = friendlyType(type);
        return count > 1 ? `${count} ${friendly}s` : `a ${friendly}`;
      });
      const totalIntensity = lights.reduce((s, l) => s + (l.intensity || 0), 0);
      let lightQuality = "";
      if (totalIntensity < 1) lightQuality = " — scene may appear quite dark, consider increasing intensity";
      else if (totalIntensity > 10) lightQuality = " — high total intensity, watch for overexposure";
      else lightQuality = " — nicely balanced illumination";
      parts.push(`\n**Lighting:** ${lightParts.join(", ")}${lightQuality}.`);
    } else {
      parts.push("\n**Lighting:** No explicit lights — using default ambient. Consider adding a directional light for shadows and depth.");
    }

    // ── Quick assessment ─────────────────────────────────────────────
    const tips = [];
    if (summary.totalTris > 500000) tips.push("Triangle count is high — use the Mesh tab to decimate or add LOD.");
    if (lights.length > 8) tips.push("Many lights active — consider baking or reducing for better FPS.");
    const zeroTri = described.filter((d) => d.tris === 0);
    if (zeroTri.length > 0) tips.push(`${zeroTri.length} object${zeroTri.length > 1 ? "s have" : " has"} zero triangles — possibly empty groups or containers.`);
    const generic = described.filter((d) => /^(Mesh|Object3D|Group|)$/.test(d.name));
    if (generic.length > 0) tips.push(`${generic.length} object${generic.length > 1 ? "s have" : " has"} generic names — use Smart Rename for clarity.`);

    if (tips.length > 0) {
      parts.push("\n**Tips:**\n" + tips.map((t) => `• ${t}`).join("\n"));
    } else if (summary.totalTris < 100000 && lights.length <= 6) {
      parts.push("\n✓ Scene is well-optimized for real-time viewing.");
    }

    const text = parts.join("\n");
    store.setResult("sceneDescription", text);
    store.setStatus("ready", "Done");
    return text;
  } catch (err) {
    store.setStatus("error", err.message);
    throw err;
  }
}

/**
 * Suggest better names for generically-named objects.
 * Tries LLM first, falls back to rule-based.
 */
export async function suggestNames(sceneChildren) {
  const store = AIStore.getState();
  store.setStatus("loading", "Generating name suggestions…");

  try {
    const serialized = sceneChildren.map(summarizeObject);
    const genericNames = new Set(["Mesh", "Object3D", "Group", "", "unnamed", "Object_1", "Object_2"]);
    const candidates = serialized.filter(
      (o) => genericNames.has(o.name) || /^(Mesh|Object3D|Group)_?\d*$/.test(o.name)
    ).slice(0, 15);

    if (candidates.length === 0) {
      store.setStatus("ready", "Done");
      return [];
    }

    // ── Try LLM ──────────────────────────────────────────────────────
    if (await isAIAvailable()) {
      try {
        const described = candidates.map((obj) => {
          const d = describeObject(obj);
          return { uuid: obj.uuid, currentName: obj.name || "(unnamed)", shape: d.shape, color: d.color, surface: d.surface, tris: d.tris };
        });
        const res = await aiSuggestNames(described);
        if (res.text) {
          // Parse numbered list: "1. SuggestedName — description"
          const lines = res.text.split("\n").filter((l) => l.trim());
          const parsed = [];
          for (let i = 0; i < lines.length && i < candidates.length; i++) {
            const m = lines[i].match(/^\d+\.?\s*(.+?)(?:\s*[-–—]|$)/);
            const suggested = m ? m[1].trim().replace(/[*_`]/g, "").slice(0, 40) : null;
            if (suggested) {
              parsed.push({ uuid: candidates[i].uuid, currentName: candidates[i].name || "(unnamed)", suggestedName: suggested });
            }
          }
          if (parsed.length > 0) {
            store.setResult("namesSuggestions", parsed);
            store.setStatus("ready", `via ${res.provider}`);
            return parsed;
          }
        }
      } catch (llmErr) {
        console.warn("[AI] LLM suggestNames failed, using fallback:", llmErr.message);
      }
    }

    // ── Rule-based fallback ──────────────────────────────────────────
    const results = candidates.map((obj, idx) => {
      const desc = describeObject(obj);
      let suggested;

      // Build a contextual name from shape + color + material
      const shape = capitalize(desc.shape.replace(/[-\s]model$/, ""));
      const color = capitalize(desc.color);

      if (desc.shape === "box" || desc.shape === "plane" || desc.shape === "sphere" ||
          desc.shape === "cone" || desc.shape === "cylinder" || desc.shape === "torus") {
        suggested = `${color} ${capitalize(desc.shape)}`;
      } else if (desc.tris > 5000) {
        suggested = `${capitalize(desc.surface)} Model ${idx + 1}`;
      } else {
        suggested = `${color} ${shape}`;
      }

      return {
        uuid: obj.uuid,
        currentName: obj.name || "(unnamed)",
        suggestedName: suggested.trim().slice(0, 40) || `Object_${idx + 1}`,
      };
    });

    store.setResult("namesSuggestions", results);
    store.setStatus("ready", "Done");
    return results;
  } catch (err) {
    store.setStatus("error", err.message);
    throw err;
  }
}

/**
 * Suggest PBR material values based on object characteristics.
 * Tries LLM first, falls back to preset knowledge base.
 */
export async function suggestMaterial(object) {
  const store = AIStore.getState();
  store.setStatus("loading", "Analyzing material…");

  try {
    const info = summarizeObject(object);
    const desc = describeObject(info);
    const currentColor = info.material?.color || "#888888";
    const currentRough = info.material?.roughness;
    const currentMetal = info.material?.metalness;

    // ── Try LLM ──────────────────────────────────────────────────────
    if (await isAIAvailable()) {
      try {
        const objInfo = { name: desc.name, shape: desc.shape, color: desc.color, surface: desc.surface, tris: desc.tris, currentColor, currentRoughness: currentRough, currentMetalness: currentMetal };
        const res = await aiSuggestMaterial(objInfo);
        if (res.text) {
          const txt = res.text;
          const rMatch = txt.match(/roughness\s*[=:]\s*([\d.]+)/i);
          const mMatch = txt.match(/metalness\s*[=:]\s*([\d.]+)/i);
          const cMatch = txt.match(/color\s*[=:]\s*(#[0-9a-fA-F]{3,8})/i);
          const pMatch = txt.match(/preset\s*[=:]\s*([\w\s]+?)(?:\n|$|description)/i);
          if (rMatch && mMatch) {
            const suggestion = {
              roughness: clamp01(parseFloat(rMatch[1])),
              metalness: clamp01(parseFloat(mMatch[1])),
              colorHex: cMatch ? cMatch[1] : currentColor,
              presetName: pMatch ? pMatch[1].trim() : "AI Suggested",
              description: txt.replace(/roughness=.*/i, "").replace(/^\s*[-•]\s*/gm, "").trim() || txt,
              raw: txt,
            };
            store.setResult("materialSuggestion", suggestion);
            store.setStatus("ready", `via ${res.provider}`);
            return suggestion;
          }
        }
      } catch (llmErr) {
        console.warn("[AI] LLM suggestMaterial failed, using fallback:", llmErr.message);
      }
    }

    // ── Rule-based fallback ──────────────────────────────────────────

    // Material presets based on visual analysis
    const PRESETS = [
      { name: "Polished Metal",   rough: 0.1,  metal: 1.0,  color: "#C0C0C0", match: (d) => d.surface.includes("metal") },
      { name: "Brushed Steel",    rough: 0.35, metal: 0.9,  color: "#A8A8A8", match: (d) => d.color === "gray" && d.tris > 100 },
      { name: "Gold",             rough: 0.2,  metal: 1.0,  color: "#FFD700", match: (d) => d.color === "yellow" },
      { name: "Polished Wood",    rough: 0.4,  metal: 0.0,  color: "#8B4513", match: (d) => d.color === "brown" || d.color === "orange" },
      { name: "Matte Plastic",    rough: 0.7,  metal: 0.0,  color: null,      match: (d) => d.surface === "matte" },
      { name: "Glossy Plastic",   rough: 0.15, metal: 0.0,  color: null,      match: (d) => d.surface === "glossy" },
      { name: "Rough Stone",      rough: 0.9,  metal: 0.0,  color: "#808080", match: (d) => d.color === "gray" && d.surface === "matte" },
      { name: "Glass-like",       rough: 0.05, metal: 0.0,  color: "#E8F0FF", match: (d) => d.color === "white" && d.surface === "glossy" },
      { name: "Concrete",         rough: 0.85, metal: 0.0,  color: "#B0B0B0", match: (d) => d.tris < 50 && d.shape === "box" },
      { name: "Ceramic",          rough: 0.3,  metal: 0.0,  color: "#F5F5DC", match: (d) => d.color === "white" },
      { name: "Rubber",           rough: 0.95, metal: 0.0,  color: "#2F2F2F", match: (d) => d.color === "black" },
      { name: "Copper",           rough: 0.25, metal: 1.0,  color: "#B87333", match: (d) => d.color === "red" && d.surface.includes("metal") },
      { name: "Marble",           rough: 0.2,  metal: 0.0,  color: "#F0EDE5", match: (d) => d.color === "white" && d.tris > 200 },
    ];

    // Find best matching preset
    let bestPreset = null;
    for (const p of PRESETS) {
      if (p.match(desc)) { bestPreset = p; break; }
    }

    if (!bestPreset) {
      const improvedRough = currentRough != null
        ? clamp01(currentRough + (currentRough > 0.5 ? -0.15 : 0.1))
        : 0.45;
      const improvedMetal = currentMetal != null
        ? clamp01(currentMetal > 0.3 ? currentMetal + 0.1 : currentMetal)
        : 0.0;
      bestPreset = {
        name: "Enhanced PBR",
        rough: improvedRough,
        metal: improvedMetal,
        color: null,
      };
    }

    // Build a thoughtful description explaining WHY these values work
    const presetName = bestPreset.name;
    const roughVal = bestPreset.rough;
    const metalVal = bestPreset.metal;
    const colorVal = bestPreset.color || currentColor;

    let reasoning;
    if (metalVal > 0.7) {
      reasoning = `**${presetName}** is recommended for "${desc.name}" — metallic surfaces reflect their surroundings, giving the ${desc.color} ${desc.shape} a realistic, physically-based look. ` +
        `A roughness of ${roughVal.toFixed(2)} ${roughVal < 0.3 ? "creates sharp, mirror-like reflections typical of polished metals" : "adds subtle surface imperfections for a brushed or weathered metallic finish"}.`;
    } else if (roughVal > 0.7) {
      reasoning = `**${presetName}** works well for "${desc.name}" — a high roughness of ${roughVal.toFixed(2)} scatters light broadly, creating a soft matte appearance with no visible reflections. ` +
        `This is ideal for ${desc.color === "gray" ? "concrete, stone, or unfinished surfaces" : `non-reflective ${desc.color} materials like clay, fabric, or uncoated plastic`}.`;
    } else if (roughVal < 0.2) {
      reasoning = `**${presetName}** gives "${desc.name}" a ${metalVal > 0 ? "reflective metallic" : "glossy, lacquered"} look — the low roughness (${roughVal.toFixed(2)}) produces crisp reflections ${metalVal > 0 ? "characteristic of polished metal" : "like glass, wet paint, or glazed ceramic"}.`;
    } else {
      reasoning = `**${presetName}** is a balanced choice for "${desc.name}" — roughness ${roughVal.toFixed(2)} and metalness ${metalVal.toFixed(2)} create a ${desc.color} surface that's ` +
        `${roughVal < 0.5 ? "slightly reflective with soft highlights" : "mostly diffuse with subtle specular response"}, suitable for ${desc.shape === "sphere" ? "organic or manufactured objects" : "architectural or prop elements"}.`;
    }

    const suggestion = {
      roughness: roughVal,
      metalness: metalVal,
      colorHex: colorVal,
      description: reasoning,
      presetName,
      raw: `preset=${presetName} roughness=${roughVal} metalness=${metalVal} color=${colorVal}`,
    };

    store.setResult("materialSuggestion", suggestion);
    store.setStatus("ready", "Done");
    return suggestion;
  } catch (err) {
    store.setStatus("error", err.message);
    throw err;
  }
}

/**
 * Answer questions about the scene using LLM or data-driven analysis.
 */
export async function askAboutScene(question, sceneChildren, scene) {
  const store = AIStore.getState();
  store.pushMessage("user", question);
  store.setStatus("loading", "Analyzing…");

  try {
    const serialized = sceneChildren.map(summarizeObject);
    const lights = scene ? collectLights(scene) : [];
    const summary = computeSceneSummary(sceneChildren);
    const q = question.toLowerCase();

    // ── Try LLM ──────────────────────────────────────────────────────
    if (await isAIAvailable()) {
      try {
        // Only send scene context for scene-related questions — not for
        // casual greetings or small talk, so the LLM responds naturally.
        const isCasual = /^(hi|hello|hey|yo|sup|howdy|greetings|what'?s up|hiya|thanks|thank you|bye|goodbye|good morning|good evening|good night|how are you)\b/i.test(q);
        const ctx = isCasual ? null : buildSceneContext(sceneChildren, scene);
        const chatHistory = store.chatHistory || [];
        const messages = chatHistory.slice(-8).map((m) => ({ role: m.role, content: m.content }));
        messages.push({ role: "user", content: question });
        const payload = { messages };
        if (ctx) payload.sceneContext = ctx;
        const res = await aiChat(payload);
        if (res.text) {
          store.pushMessage("assistant", res.text);
          store.setStatus("ready", `via ${res.provider}`);
          return res.text;
        }
      } catch (llmErr) {
        console.warn("[AI] LLM chat failed, using fallback:", llmErr.message);
      }
    }

    let answer = "";

    // ── Rule-based fallback: Conversational + scene-aware ────────────

    // Greetings / casual
    if (q.match(/^(hi|hello|hey|yo|sup|howdy|greetings|what'?s up|hiya)\b/)) {
      const objCount = summary.objects;
      if (objCount === 0) {
        answer = "Hey! 👋 Your scene is empty right now. Try adding some primitives from the toolbar or importing a GLB model — then I can help you analyze materials, lighting, and performance.";
      } else {
        const heroObj = serialized.length > 0 ? describeObject(serialized.sort((a, b) => (b.geometry?.tris || 0) - (a.geometry?.tris || 0))[0]) : null;
        answer = `Hey! 👋 You've got a scene with ${objCount} object${objCount > 1 ? "s" : ""} and ${formatNum(summary.totalTris)} triangles.` +
          (heroObj ? ` Your main object looks like "${heroObj.name}" — a ${heroObj.color} ${heroObj.shape}.` : "") +
          `\n\nI can help with:\n• **"Describe my scene"** — detailed overview\n• **"Suggest materials"** — PBR values for selected objects\n• **"How to optimize?"** — performance tips\n• **"What objects are here?"** — full object list`;
      }
    } else if (q.match(/thanks|thank you|thx|ty|cheers|appreciated/)) {
      answer = "You're welcome! Let me know if you need anything else — I'm here to help with your 3D scene. 🎨";
    } else if (q.match(/who are you|what are you|your name/)) {
      answer = "I'm **Objekta AI** — your 3D scene assistant. I analyze your scene data to give you insights about objects, materials, lighting, and optimization. For the best responses, configure an API key in the Settings to enable LLM-powered answers!";
    } else if (q.match(/how many|count|number of/)) {
      if (q.match(/triangle|tris|poly/)) {
        const triCount = formatNum(summary.totalTris);
        answer = `Your scene has **${triCount} triangles** across ${summary.objects} object${summary.objects !== 1 ? "s" : ""}.`;
        if (summary.objectsList?.length > 0) {
          const top3 = [...summary.objectsList].sort((a, b) => b.tris - a.tris).slice(0, 3);
          answer += "\n\nHeaviest objects:\n" + top3.map((o, i) => `${i + 1}. **${o.name || "Unnamed"}** — ${formatNum(o.tris)} tris`).join("\n");
        }
        if (summary.totalTris > 500000) answer += "\n\n⚠️ That's quite heavy for real-time — consider decimating the largest meshes.";
        else if (summary.totalTris < 50000) answer += "\n\n✓ Very lightweight — great for real-time performance.";
      } else if (q.match(/light/)) {
        answer = lights.length === 0
          ? "No explicit lights in the scene — it's using default ambient illumination. Consider adding a **DirectionalLight** for crisp shadows and depth."
          : `**${lights.length} light${lights.length > 1 ? "s" : ""}** in the scene:\n` + lights.map((l) => `• ${friendlyType(l.type)} "${l.name || "unnamed"}" — intensity ${l.intensity}, color ${l.color}`).join("\n");
      } else if (q.match(/object|mesh|model/)) {
        answer = `**${summary.objects} object${summary.objects !== 1 ? "s" : ""}** totaling ${formatNum(summary.totalTris)} triangles.`;
      } else {
        answer = `**Scene stats:** ${summary.objects} object${summary.objects !== 1 ? "s" : ""}, ${formatNum(summary.totalTris)} triangles, ${lights.length} light${lights.length !== 1 ? "s" : ""}.`;
      }
    } else if (q.match(/list|show|what.*object|what.*scene|what'?s.*in|inventory/)) {
      if (serialized.length === 0) {
        answer = "The scene is empty — add objects from the toolbar to get started!";
      } else {
        const items = serialized.slice(0, 15).map((o) => {
          const d = describeObject(o);
          return `• **${d.name}** — ${d.color} ${d.surface} ${d.shape} (${formatNum(d.tris)} tris)`;
        });
        answer = `**Objects in scene (${serialized.length}):**\n${items.join("\n")}`;
        if (serialized.length > 15) answer += `\n\n…and ${serialized.length - 15} more objects.`;
      }
    } else if (q.match(/optimi|performance|slow|heavy|improve|fps|speed|lag/)) {
      const issues = [];
      if (summary.totalTris > 500000) issues.push(`🔴 **High poly count** (${formatNum(summary.totalTris)} tris) — decimate the heaviest meshes using the Mesh Tools panel, or generate LOD levels.`);
      if (lights.length > 6) issues.push(`🟡 **${lights.length} lights** is a lot — each real-time light has a GPU cost. Try baking static lights or reducing to 4-6.`);
      const heavyObjs = (summary.objectsList || []).filter((o) => o.tris > 100000);
      if (heavyObjs.length > 0) {
        issues.push(`🟡 ${heavyObjs.length} object${heavyObjs.length > 1 ? "s" : ""} exceed${heavyObjs.length === 1 ? "s" : ""} 100k tris: ${heavyObjs.slice(0, 3).map((o) => `"${o.name || "Unnamed"}" (${formatNum(o.tris)})`).join(", ")} — use LOD or the decimator.`);
      }
      const zeroLights = lights.filter((l) => l.intensity === 0);
      if (zeroLights.length > 0) issues.push(`🟡 ${zeroLights.length} light${zeroLights.length > 1 ? "s" : ""} with zero intensity — safe to remove.`);
      const emptyObj = serialized.filter((o) => (o.geometry?.tris || 0) === 0);
      if (emptyObj.length > 0) issues.push(`ℹ️ ${emptyObj.length} empty object${emptyObj.length > 1 ? "s" : ""} (0 tris) — consider removing unused groups.`);

      if (issues.length > 0) {
        answer = "**Performance Analysis:**\n\n" + issues.join("\n\n");
      } else {
        answer = `✅ **Scene looks great!** ${summary.objects} objects, ${formatNum(summary.totalTris)} tris, ${lights.length} lights — well within real-time budgets. No immediate optimization needed.`;
      }
    } else if (q.match(/material|texture|color|rough|metal|pbr|shader/)) {
      if (serialized.length === 0) {
        answer = "No objects to analyze yet. Add some objects and I'll break down their materials!";
      } else {
        const matLines = serialized.slice(0, 10).map((o) => {
          const d = describeObject(o);
          const r = o.material?.roughness;
          const m = o.material?.metalness;
          return `• **${d.name}** — ${d.color} ${d.surface} | roughness: ${r != null ? r.toFixed(2) : "default"}, metalness: ${m != null ? m.toFixed(2) : "default"}`;
        });
        answer = `**Material Breakdown:**\n${matLines.join("\n")}`;
        answer += "\n\n💡 Select an object and click **Suggest Material** for PBR recommendations.";
      }
    } else if (q.match(/light|lighting|shadow|bright|dark|illumin/)) {
      if (lights.length === 0) {
        answer = "No explicit lights — the scene uses default ambient illumination.\n\n**Suggestions:**\n• Add a **DirectionalLight** (sun-like) for crisp shadows\n• Add a **HemisphereLight** for soft sky/ground color gradient\n• Add a **PointLight** for localized warm accents";
      } else {
        const lightDescs = lights.map((l) =>
          `• **${friendlyType(l.type)}** "${l.name || "unnamed"}" — intensity ${l.intensity}, color ${l.color}`
        );
        answer = `**Lighting Setup (${lights.length} sources):**\n${lightDescs.join("\n")}`;
        const totalIntensity = lights.reduce((s, l) => s + (l.intensity || 0), 0);
        if (totalIntensity < 1) answer += "\n\n⚠️ Total intensity is low — the scene may appear dark. Try increasing your key light.";
        else if (totalIntensity > 10) answer += "\n\n⚠️ Total intensity is high — watch for blown-out highlights. Consider lowering some lights.";
        else answer += "\n\n✓ Light balance looks good.";
      }
    } else if (q.match(/export|save|download|share|glb|gltf/)) {
      answer = `**Exporting your scene:**\n• Use the **Export** button in the toolbar for GLB/glTF format\n• Current size: ${summary.objects} objects, ${formatNum(summary.totalTris)} tris\n• For smaller files: decimate heavy meshes first in the Optimize panel\n• GLB is the recommended format for web and game engines`;
    } else if (q.match(/name|rename/)) {
      const generic = serialized.filter((o) => /^(Mesh|Object3D|Group|)$/.test(o.name));
      answer = generic.length > 0
        ? `**${generic.length} object${generic.length > 1 ? "s" : ""}** with generic names found. Click the **Smart Rename** button above for AI-powered name suggestions based on shape, color, and material.`
        : "✓ All objects already have descriptive names — nice work keeping things organized!";
    } else if (q.match(/help|what can|capability|feature|how.*use/)) {
      answer = "**I'm Objekta AI — here's what I can do:**\n\n" +
        "🎨 **Describe Scene** — Detailed analysis of your objects, materials, and lighting\n" +
        "📝 **Smart Rename** — Context-aware name suggestions for generic objects\n" +
        "🎯 **Suggest Material** — PBR material values based on object characteristics\n" +
        "⚡ **Analyze Scene** — Performance optimization recommendations\n\n" +
        "You can also ask me questions like:\n" +
        "• *\"How many triangles in my scene?\"*\n" +
        "• *\"Show me the lighting setup\"*\n" +
        "• *\"How can I optimize performance?\"*\n" +
        "• *\"What materials are being used?\"*";
    } else {
      // ── Conversational fallback — don't just dump data ─────────────
      if (serialized.length === 0) {
        answer = "Your scene is empty right now! Add some objects from the toolbar or import a model, and I'll be able to help with materials, lighting, optimization, and more.";
      } else {
        // Try to give a relevant contextual response instead of a data dump
        const topObj = serialized.slice(0, 3).map((o) => describeObject(o));
        const topNames = topObj.map((d) => `"${d.name}"`).join(", ");
        answer = `I'm not sure exactly what you're looking for — let me give you a quick overview:\n\n` +
          `Your scene has **${summary.objects} objects** (${formatNum(summary.totalTris)} tris) with ${lights.length} light${lights.length !== 1 ? "s" : ""}. ` +
          `Notable objects: ${topNames}.\n\n` +
          `Try asking something specific:\n` +
          `• *"How can I optimize this?"*\n` +
          `• *"What materials are used?"*\n` +
          `• *"Describe my scene in detail"*\n` +
          `• *"How's the lighting?"*`;
      }
    }

    store.pushMessage("assistant", answer);
    store.setStatus("ready", "Done");
    return answer;
  } catch (err) {
    store.pushMessage("assistant", `Error: ${err.message}`);
    store.setStatus("error", err.message);
    throw err;
  }
}

/**
 * Analyze optimizations (rule-based, instant — no model needed).
 */
export async function analyzeSceneOptimizations(sceneChildren, scene) {
  const store = AIStore.getState();
  store.setStatus("loading", "Checking optimizations…");

  try {
    const summary = computeSceneSummary(sceneChildren);
    const lights = scene ? collectLights(scene) : [];
    const serialized = sceneChildren.map(summarizeObject);
    const suggestions = [];
    let sugIdx = 0;

    // ── Scene-level checks ──────────────────────────────────────────
    if (sceneChildren.length === 0) {
      suggestions.push({
        id: `opt-${sugIdx++}`, category: "general",
        summary: "Scene is empty. Add objects from the palette or import a GLB model.",
        payload: null, applied: false,
      });
      store.addSuggestions(suggestions);
      store.setStatus("ready", "Done");
      return suggestions;
    }

    if (summary.totalTris > 2_000_000) {
      suggestions.push({
        id: `opt-${sugIdx++}`, category: "critical",
        summary: `Scene has ${formatNum(summary.totalTris)} triangles — extremely heavy for real-time. Strongly recommend decimation and LOD.`,
        payload: null, applied: false,
      });
    } else if (summary.totalTris > 500_000) {
      suggestions.push({
        id: `opt-${sugIdx++}`, category: "optimization",
        summary: `Scene has ${formatNum(summary.totalTris)} triangles. Consider decimating heavy meshes for smoother performance (target < 500k).`,
        payload: null, applied: false,
      });
    }

    // Per-object checks
    for (const o of summary.objectsList) {
      if (o.tris > 100_000) {
        suggestions.push({
          id: `opt-${sugIdx++}`, category: "optimization",
          summary: `"${o.name || o.uuid}" has ${formatNum(o.tris)} tris — use the Mesh tab to decimate or generate LOD levels.`,
          payload: { uuid: o.uuid }, applied: false,
        });
      }
    }

    // Duplicate detection
    const posMap = new Map();
    for (const obj of serialized) {
      const key = `${obj.geometry.tris}_${fmt(obj.position.x)}_${fmt(obj.position.y)}_${fmt(obj.position.z)}`;
      if (posMap.has(key)) {
        suggestions.push({
          id: `opt-${sugIdx++}`, category: "optimization",
          summary: `"${obj.name}" may be a duplicate of "${posMap.get(key)}" at the same position — consider instancing.`,
          payload: { uuid: obj.uuid }, applied: false,
        });
      } else {
        posMap.set(key, obj.name || obj.uuid);
      }
    }

    // Lighting checks
    if (lights.length > 8) {
      suggestions.push({
        id: `opt-${sugIdx++}`, category: "lighting",
        summary: `${lights.length} lights active — consider baking or reducing to 4-6 for better FPS.`,
        payload: null, applied: false,
      });
    }

    for (const l of lights) {
      if (l.intensity === 0) {
        suggestions.push({
          id: `opt-${sugIdx++}`, category: "lighting",
          summary: `"${l.name || l.type}" has 0 intensity — remove it to clean up the scene.`,
          payload: { uuid: l.uuid }, applied: false,
        });
      }
    }

    // All-clear message
    if (suggestions.length === 0) {
      const budget = summary.totalTris < 50000 ? "very lightweight" : summary.totalTris < 200000 ? "moderate" : "within acceptable range";
      suggestions.push({
        id: `opt-${sugIdx++}`, category: "general",
        summary: `✅ Scene is well-optimized — ${summary.objects} objects, ${formatNum(summary.totalTris)} tris (${budget}), ${lights.length} lights. No issues detected.`,
        payload: null, applied: false,
      });
    }

    store.addSuggestions(suggestions);
    store.setStatus("ready", "Done");
    return suggestions;
  } catch (err) {
    store.setStatus("error", err.message);
    throw err;
  }
}

// ── Util ──────────────────────────────────────────────────────────────
function clamp01(v) {
  return Math.max(0, Math.min(1, isNaN(v) ? 0 : v));
}
