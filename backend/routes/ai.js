// backend/routes/ai.js
// ---------------------------------------------------------------------------
// AI proxy routes — prefers Python FastAPI service for high-quality responses,
// falls back to direct JS LLM calls if Python service is unavailable.
// ---------------------------------------------------------------------------

const express = require("express");
const router = express.Router();
const http = require("http");
const https = require("https");
const rateLimit = require("express-rate-limit");
const { chat, availableProviders, checkOllamaStatus } = require("../services/aiProviders");
const { protect } = require("../middleware/authMiddleware");

// Python AI service URL (default: localhost:8100)
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8100";
const AI_MODEL = process.env.OLLAMA_MODEL || process.env.AI_MODEL || "qwen2.5:14b-instruct";

function parseBool(value, defaultValue = false) {
  if (value == null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

const AI_REQUIRE_LLM = parseBool(process.env.AI_REQUIRE_LLM, false);

function llmUnavailableMessage(reason = "") {
  const parts = [
    "No model-backed AI provider is currently reachable.",
    "Configure a free provider (GROQ_API_KEY or GEMINI_API_KEY) or run a local Ollama model.",
  ];
  if (reason) parts.push(`Reason: ${reason}`);
  return parts.join(" ");
}

function resolveActiveProvider(providers = []) {
  const forced = String(process.env.AI_PROVIDER || "").trim().toLowerCase();
  if (forced && forced !== "auto" && providers.includes(forced)) return forced;
  const preferred = ["groq", "gemini", "ollama", "openai", "anthropic"].find((p) => providers.includes(p));
  return preferred || providers[0] || null;
}

const aiWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number.parseInt(process.env.AI_RATE_LIMIT_PER_MIN || "20", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "AI rate limit exceeded" },
});

// ── Helper: proxy request to Python AI service ──────────────────────────
function proxyToPython(path, body, timeout = 45000) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, AI_SERVICE_URL);
    const lib = url.protocol === "https:" ? https : http;
    const postData = JSON.stringify(body);
    const req = lib.request(
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

function proxyToPythonGet(path, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, AI_SERVICE_URL);
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "GET",
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
• When the user sends a greeting (hi, hello, hey), a thank-you, or casual message, respond naturally and warmly — introduce yourself briefly and offer to help. Do NOT dump scene data in response to greetings.
• If the user asks for scene ideas/concepts/themes (e.g., cyberpunk), respond directly with at least 3 concrete concepts. Do NOT ask them to rephrase.
• Be concise but thorough — give actionable advice, not vague suggestions
• When suggesting material values, provide exact numbers (roughness: 0.35, metalness: 0.9)
• For optimization, give specific thresholds (e.g. "reduce to <500k triangles for mobile")
• Reference actual scene data when available AND relevant to the question — mention object names, triangle counts, etc.
• For creative ideation responses, include: concept title, core assets, lighting style, and camera shot suggestion.
• Format responses clearly with bullet points for lists
• Keep responses under 300 words unless the user asks for detail
• Never hallucinate scene objects — only reference what's in the provided context
• If the scene context is empty and the user asks about it, acknowledge it and suggest adding objects`;

// ── POST /api/ai/chat — main chat endpoint ───────────────────────────
router.post("/chat", protect, aiWriteLimiter, async (req, res) => {
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

    try {
      const result = await chat(llmMessages, { provider, model, maxTokens: maxTokens || 1024, temperature: temperature ?? 0.7 });
      return res.json({ success: true, text: result.text, provider: result.provider, model: result.model });
    } catch (llmErr) {
      if (AI_REQUIRE_LLM) {
        return res.status(503).json({
          success: false,
          requiresLLM: true,
          message: llmUnavailableMessage(llmErr.message),
        });
      }
      throw llmErr;
    }
  } catch (err) {
    console.error("[AI route] error:", err.message);
    if (AI_REQUIRE_LLM) {
      return res.status(503).json({
        success: false,
        requiresLLM: true,
        message: llmUnavailableMessage(err.message),
      });
    }
    res.status(500).json({ success: false, message: err.message, fallback: true });
  }
});

// ── POST /api/ai/describe — describe scene ───────────────────────────
router.post("/describe", protect, aiWriteLimiter, async (req, res) => {
  try {
    const { sceneContext } = req.body;
    if (!sceneContext) {
      return res.status(400).json({ success: false, message: "sceneContext required" });
    }

    // Try Python AI service first
    const pyResult = await tryPython("/api/ai/describe", { sceneContext });
    if (pyResult) return res.json(pyResult);

    // Fallback: JS LLM
    try {
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

      return res.json({ success: true, text: result.text, provider: result.provider, model: result.model });
    } catch (llmErr) {
      if (AI_REQUIRE_LLM) {
        return res.status(503).json({
          success: false,
          requiresLLM: true,
          message: llmUnavailableMessage(llmErr.message),
        });
      }
      throw llmErr;
    }
  } catch (err) {
    console.error("[AI describe] error:", err.message);
    if (AI_REQUIRE_LLM) {
      return res.status(503).json({
        success: false,
        requiresLLM: true,
        message: llmUnavailableMessage(err.message),
      });
    }
    res.status(500).json({ success: false, message: err.message, fallback: true });
  }
});

// ── POST /api/ai/suggest-material — material suggestions ─────────────
router.post("/suggest-material", protect, aiWriteLimiter, async (req, res) => {
  try {
    const { objectInfo, sceneContext } = req.body;
    if (!objectInfo) {
      return res.status(400).json({ success: false, message: "objectInfo required" });
    }

    // Try Python AI service first
    const pyResult = await tryPython("/api/ai/suggest-material", { objectInfo, sceneContext });
    if (pyResult) return res.json(pyResult);

    // Fallback: JS LLM
    try {
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

      return res.json({ success: true, text: result.text, provider: result.provider, model: result.model });
    } catch (llmErr) {
      if (AI_REQUIRE_LLM) {
        return res.status(503).json({
          success: false,
          requiresLLM: true,
          message: llmUnavailableMessage(llmErr.message),
        });
      }
      throw llmErr;
    }
  } catch (err) {
    console.error("[AI suggest-material] error:", err.message);
    if (AI_REQUIRE_LLM) {
      return res.status(503).json({
        success: false,
        requiresLLM: true,
        message: llmUnavailableMessage(err.message),
      });
    }
    res.status(500).json({ success: false, message: err.message, fallback: true });
  }
});

// ── POST /api/ai/suggest-names — name suggestions ────────────────────
router.post("/suggest-names", protect, aiWriteLimiter, async (req, res) => {
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

    try {
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

      return res.json({ success: true, text: result.text, provider: result.provider, model: result.model });
    } catch (llmErr) {
      if (AI_REQUIRE_LLM) {
        return res.status(503).json({
          success: false,
          requiresLLM: true,
          message: llmUnavailableMessage(llmErr.message),
        });
      }
      throw llmErr;
    }
  } catch (err) {
    console.error("[AI suggest-names] error:", err.message);
    if (AI_REQUIRE_LLM) {
      return res.status(503).json({
        success: false,
        requiresLLM: true,
        message: llmUnavailableMessage(err.message),
      });
    }
    res.status(500).json({ success: false, message: err.message, fallback: true });
  }
});

// ── POST /api/ai/optimize — scene optimization (Python-only) ─────────
router.post("/optimize", protect, aiWriteLimiter, async (req, res) => {
  try {
    const { sceneContext } = req.body;
    if (!sceneContext) {
      return res.status(400).json({ success: false, message: "sceneContext required" });
    }

    const pyResult = await tryPython("/api/ai/optimize", { sceneContext });
    if (pyResult) return res.json(pyResult);

    // No JS fallback for optimize — use chat endpoint instead
    res.status(503).json({
      success: false,
      requiresLLM: AI_REQUIRE_LLM,
      message: AI_REQUIRE_LLM
        ? llmUnavailableMessage("Python AI optimization service unavailable")
        : "Python AI service unavailable for optimization",
    });
  } catch (err) {
    console.error("[AI optimize] error:", err.message);
    if (AI_REQUIRE_LLM) {
      return res.status(503).json({
        success: false,
        requiresLLM: true,
        message: llmUnavailableMessage(err.message),
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/ai/status — check which providers are available ─────────
router.get("/status", async (_req, res) => {
  const providers = availableProviders();
  let pythonAvailable = false;
  try {
    const pyHealth = await proxyToPythonGet("/health", 10000);
    pythonAvailable = pyHealth.status >= 200 && pyHealth.status < 300;
  } catch (_) { /* ignore */ }

  const ollama = providers.includes("ollama") ? await checkOllamaStatus() : null;
  const hasCloudProvider = providers.some((p) => p !== "ollama");
  const localOllamaReady = !!(ollama?.reachable && ollama?.modelReady);
  const llmReady = pythonAvailable || hasCloudProvider || localOllamaReady;

  res.json({
    success: true,
    configured: providers.length > 0 || pythonAvailable,
    llmReady,
    strictLLM: AI_REQUIRE_LLM,
    providers,
    pythonService: pythonAvailable,
    activeProvider: pythonAvailable ? "python" : resolveActiveProvider(providers),
    ollama,
  });
});

module.exports = router;
