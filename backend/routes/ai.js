// backend/routes/ai.js
// ---------------------------------------------------------------------------
// AI proxy routes — prefers Python FastAPI service for high-quality responses,
// falls back to direct JS LLM calls if Python service is unavailable.
// ---------------------------------------------------------------------------

const express = require("express");
const router = express.Router();
const http = require("http");
const { chat, availableProviders } = require("../services/aiProviders");

// Python AI service URL (default: localhost:8100)
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8100";

// ── Helper: proxy request to Python AI service ──────────────────────────
function proxyToPython(path, body, timeout = 45000) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, AI_SERVICE_URL);
    const postData = JSON.stringify(body);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) },
        timeout,
      },
      (res) => {
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf-8");
          try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
          catch { resolve({ status: res.statusCode, data: raw }); }
        });
      }
    );
    req.on("error", (err) => reject(err));
    req.on("timeout", () => { req.destroy(); reject(new Error("Python AI service timeout")); });
    req.write(postData);
    req.end();
  });
}

async function tryPython(path, body) {
  try {
    const { status, data } = await proxyToPython(path, body);
    if (status >= 200 && status < 300 && data?.success) return data;
    return null;
  } catch { return null; }
}

// ── 3D Scene Specialist System Prompt (JS fallback) ─────────────────────

const SYSTEM_PROMPT = `You are Objekta AI — an expert 3D scene assistant built into a browser-based 3D editor called Objekta.

Your capabilities:
• Describe 3D scenes accurately based on provided scene data (object names, positions, materials, geometry stats)
• Suggest PBR material values (roughness, metalness, color) for realistic rendering
• Recommend scene optimizations (triangle budget, draw calls, texture sizes, LOD, instancing)
• Answer questions about Three.js, WebGL, PBR workflows, 3D modeling best practices
• Suggest meaningful object names based on their shape, color, and material properties
• Help with lighting setups, camera angles, and composition

Guidelines:
• Be concise but thorough — give actionable advice, not vague suggestions
• When suggesting material values, provide exact numbers (roughness: 0.35, metalness: 0.9)
• For optimization, give specific thresholds (e.g. "reduce to <500k triangles for mobile")
• Reference actual scene data when available — mention object names, triangle counts, etc.
• Format responses clearly with bullet points for lists
• Keep responses under 300 words unless the user asks for detail
• Never hallucinate scene objects — only reference what's in the provided context
• If the scene context is empty, acknowledge it and suggest adding objects`;

// ── POST /api/ai/chat — main chat endpoint ───────────────────────────
router.post("/chat", async (req, res) => {
  try {
    const { messages, sceneContext, provider, model, maxTokens, temperature, task } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: "messages array required" });
    }

    // Try Python AI service first (better prompts, structured responses)
    const pyResult = await tryPython("/api/ai/chat", { messages, sceneContext, provider, model, maxTokens, temperature, task });
    if (pyResult) return res.json(pyResult);

    // Fallback: direct JS LLM call
    const llmMessages = [{ role: "system", content: SYSTEM_PROMPT }];
    if (sceneContext) {
      llmMessages.push({ role: "system", content: `Current 3D scene state:\n${sceneContext}` });
    }
    for (const msg of messages) {
      if (msg.role === "user" || msg.role === "assistant") {
        llmMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const result = await chat(llmMessages, { provider, model, maxTokens: maxTokens || 1024, temperature: temperature ?? 0.7 });
    res.json({ success: true, text: result.text, provider: result.provider, model: result.model });
  } catch (err) {
    console.error("[AI route] error:", err.message);
    res.status(500).json({ success: false, message: err.message, fallback: true });
  }
});

// ── POST /api/ai/describe — describe scene ───────────────────────────
router.post("/describe", async (req, res) => {
  try {
    const { sceneContext } = req.body;
    if (!sceneContext) {
      return res.status(400).json({ success: false, message: "sceneContext required" });
    }

    // Try Python AI service first
    const pyResult = await tryPython("/api/ai/describe", { sceneContext });
    if (pyResult) return res.json(pyResult);

    // Fallback: JS LLM
    const result = await chat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: `Current 3D scene state:\n${sceneContext}` },
        {
          role: "user",
          content:
            "Describe this 3D scene in detail. Mention what objects are present, their visual appearance, the lighting setup, and overall composition. Be specific about colors, shapes, and spatial arrangement.",
        },
      ],
      { maxTokens: 512, temperature: 0.6 }
    );

    res.json({ success: true, text: result.text, provider: result.provider, model: result.model });
  } catch (err) {
    console.error("[AI describe] error:", err.message);
    res.status(500).json({ success: false, message: err.message, fallback: true });
  }
});

// ── POST /api/ai/suggest-material — material suggestions ─────────────
router.post("/suggest-material", async (req, res) => {
  try {
    const { objectInfo, sceneContext } = req.body;
    if (!objectInfo) {
      return res.status(400).json({ success: false, message: "objectInfo required" });
    }

    // Try Python AI service first
    const pyResult = await tryPython("/api/ai/suggest-material", { objectInfo, sceneContext });
    if (pyResult) return res.json(pyResult);

    // Fallback: JS LLM
    const result = await chat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        ...(sceneContext ? [{ role: "system", content: `Scene:\n${sceneContext}` }] : []),
        {
          role: "user",
          content: `Suggest improved PBR material values for this 3D object:\n${objectInfo}\n\nRespond in this exact format:\nroughness=<0-1>\nmetalness=<0-1>\ncolor=#<hex>\npreset=<name>\ndescription=<one paragraph explaining why these values work>`,
        },
      ],
      { maxTokens: 300, temperature: 0.5 }
    );

    res.json({ success: true, text: result.text, provider: result.provider, model: result.model });
  } catch (err) {
    console.error("[AI suggest-material] error:", err.message);
    res.status(500).json({ success: false, message: err.message, fallback: true });
  }
});

// ── POST /api/ai/suggest-names — name suggestions ────────────────────
router.post("/suggest-names", async (req, res) => {
  try {
    const { objects } = req.body;
    if (!objects || !Array.isArray(objects)) {
      return res.status(400).json({ success: false, message: "objects array required" });
    }

    // Try Python AI service first
    const pyResult = await tryPython("/api/ai/suggest-names", { objects });
    if (pyResult) return res.json(pyResult);

    // Fallback: JS LLM
    const objList = objects.map((o, i) => {
      return `${i + 1}. Current: "${o.name}" | Shape: ${o.shape} | Color: ${o.color} | Material: ${o.surface} | Tris: ${o.tris}`;
    }).join("\n");

    const result = await chat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `These 3D objects have generic/unnamed names. Suggest better descriptive names:\n${objList}\n\nRespond with ONLY a numbered list like:\n1. SuggestedName\n2. SuggestedName\n\nNames should be descriptive, PascalCase, max 30 chars.`,
        },
      ],
      { maxTokens: 300, temperature: 0.6 }
    );

    res.json({ success: true, text: result.text, provider: result.provider, model: result.model });
  } catch (err) {
    console.error("[AI suggest-names] error:", err.message);
    res.status(500).json({ success: false, message: err.message, fallback: true });
  }
});

// ── POST /api/ai/optimize — scene optimization (Python-only) ─────────
router.post("/optimize", async (req, res) => {
  try {
    const { sceneContext } = req.body;
    if (!sceneContext) {
      return res.status(400).json({ success: false, message: "sceneContext required" });
    }

    const pyResult = await tryPython("/api/ai/optimize", { sceneContext });
    if (pyResult) return res.json(pyResult);

    // No JS fallback for optimize — use chat endpoint instead
    res.status(503).json({ success: false, message: "Python AI service unavailable for optimization" });
  } catch (err) {
    console.error("[AI optimize] error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/ai/status — check which providers are available ─────────
router.get("/status", async (_req, res) => {
  const providers = availableProviders();
  let pythonAvailable = false;
  try {
    const pyStatus = await tryPython("/health", {});
    pythonAvailable = !!pyStatus;
  } catch (_) { /* ignore */ }

  res.json({
    success: true,
    configured: providers.length > 0 || pythonAvailable,
    providers,
    pythonService: pythonAvailable,
    activeProvider: pythonAvailable ? "python" : (process.env.AI_PROVIDER || providers[0] || null),
  });
});

module.exports = router;
