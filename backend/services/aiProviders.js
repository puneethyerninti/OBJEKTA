// backend/services/aiProviders.js
// ---------------------------------------------------------------------------
// Multi-provider LLM adapter.  Each provider is a thin wrapper that accepts
// a messages array [{role, content}] and returns { text, provider, model }.
//
// Supported providers:
//   - Groq          — free tier, fast (Llama family)
//   - Google Gemini — free tier
//   - Ollama        — local models (no API key)
//   - OpenAI        — paid (optional)
//   - Anthropic     — paid (optional)
//
// Configuration via env vars:
//   GROQ_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY
//   AI_PROVIDER  (optional, force a specific provider)
//   AI_MODEL     (optional, override the default model for the provider)
// ---------------------------------------------------------------------------

const https = require("https");
const http = require("http");

// ── Generic JSON POST helper ──────────────────────────────────────────
function jsonPost(url, headers, body, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const postData = JSON.stringify(body);
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
          ...headers,
        },
        timeout,
      },
      (res) => {
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf-8");
          try {
            resolve({ status: res.statusCode, data: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, data: raw });
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.write(postData);
    req.end();
  });
}

function jsonGet(url, headers = {}, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers,
        timeout,
      },
      (res) => {
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf-8");
          try {
            resolve({ status: res.statusCode, data: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, data: raw });
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.end();
  });
}

function normalizeModelName(name) {
  return String(name || "").trim().toLowerCase();
}

function stripModelTag(name) {
  return normalizeModelName(name).split(":")[0];
}

const DEFAULT_PROVIDER_ORDER = ["groq", "gemini", "ollama", "openai", "anthropic"];

function resolveModelForProvider(provider, optsModel, defaultModel) {
  if (optsModel) return optsModel;

  const providerEnvModel = process.env[`${provider.toUpperCase()}_MODEL`];
  if (providerEnvModel) return providerEnvModel;

  // Keep backward compatibility: global AI_MODEL only applies when provider is explicitly selected.
  const activeProvider = normalizeModelName(process.env.AI_PROVIDER);
  if (activeProvider === provider && process.env.AI_MODEL) {
    return process.env.AI_MODEL;
  }

  return defaultModel;
}

function isProviderConfigured(name) {
  switch (name) {
    case "ollama":
      return process.env.AI_PROVIDER === "ollama" || !!process.env.OLLAMA_HOST;
    case "groq":
      return !!process.env.GROQ_API_KEY;
    case "gemini":
      return !!process.env.GEMINI_API_KEY;
    case "openai":
      return !!process.env.OPENAI_API_KEY;
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY;
    default:
      return false;
  }
}

function resolveProviderOrder(forcedProvider) {
  const configuredPriority = String(process.env.AI_PROVIDER_PRIORITY || "")
    .split(",")
    .map((p) => normalizeModelName(p))
    .filter((p) => p && DEFAULT_PROVIDER_ORDER.includes(p));

  const base = configuredPriority.length > 0
    ? [...new Set(configuredPriority)]
    : DEFAULT_PROVIDER_ORDER;

  if (forcedProvider && DEFAULT_PROVIDER_ORDER.includes(forcedProvider)) {
    return [forcedProvider, ...base.filter((p) => p !== forcedProvider)];
  }
  return base;
}

// ═══════════════════════════════════════════════════════════════════════
//  Provider adapters
// ═══════════════════════════════════════════════════════════════════════

/** Ollama (local) */
async function ollamaChat(messages, opts = {}) {
  const host = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
  const model = resolveModelForProvider("ollama", opts.model, "qwen2.5:14b-instruct");

  const { status, data } = await jsonPost(
    `${host}/api/chat`,
    {},
    {
      model,
      messages,
      stream: false,
      options: {
        temperature: opts.temperature ?? 0.7,
        num_predict: opts.maxTokens || 1024,
      },
    },
    120000
  );

  if (status !== 200) throw new Error(`Ollama ${status}: ${JSON.stringify(data)}`);
  const text = data?.message?.content || data?.response || "";
  return { text, provider: "ollama", model };
}

/** Groq (free tier — Llama 3 70B / Mixtral) */
async function groqChat(messages, opts = {}) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");
  const model = resolveModelForProvider("groq", opts.model, "llama-3.3-70b-versatile");
  const { status, data } = await jsonPost(
    "https://api.groq.com/openai/v1/chat/completions",
    { Authorization: `Bearer ${key}` },
    {
      model,
      messages,
      max_tokens: opts.maxTokens || 1024,
      temperature: opts.temperature ?? 0.7,
    }
  );
  if (status !== 200) throw new Error(`Groq ${status}: ${JSON.stringify(data)}`);
  const text = data?.choices?.[0]?.message?.content || "";
  return { text, provider: "groq", model };
}

/** Google Gemini (free tier — gemini-2.0-flash) */
async function geminiChat(messages, opts = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const model = resolveModelForProvider("gemini", opts.model, "gemini-2.0-flash");

  // Convert OpenAI-style messages → Gemini format
  const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content);
  const contents = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  }

  const body = {
    contents,
    generationConfig: {
      maxOutputTokens: opts.maxTokens || 1024,
      temperature: opts.temperature ?? 0.7,
    },
  };
  if (systemParts.length > 0) {
    body.systemInstruction = { parts: [{ text: systemParts.join("\n") }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const { status, data } = await jsonPost(url, {}, body);
  if (status !== 200) throw new Error(`Gemini ${status}: ${JSON.stringify(data)}`);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return { text, provider: "gemini", model };
}

/** OpenAI (gpt-4o-mini / gpt-4o) */
async function openaiChat(messages, opts = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const model = resolveModelForProvider("openai", opts.model, "gpt-4o-mini");
  const { status, data } = await jsonPost(
    "https://api.openai.com/v1/chat/completions",
    { Authorization: `Bearer ${key}` },
    {
      model,
      messages,
      max_tokens: opts.maxTokens || 1024,
      temperature: opts.temperature ?? 0.7,
    }
  );
  if (status !== 200) throw new Error(`OpenAI ${status}: ${JSON.stringify(data)}`);
  const text = data?.choices?.[0]?.message?.content || "";
  return { text, provider: "openai", model };
}

/** Anthropic (Claude 3.5 Sonnet / Haiku) */
async function anthropicChat(messages, opts = {}) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const model = resolveModelForProvider("anthropic", opts.model, "claude-sonnet-4-20250514");
  const systemMsgs = messages.filter((m) => m.role === "system");
  const chatMsgs = messages.filter((m) => m.role !== "system").map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  const body = {
    model,
    max_tokens: opts.maxTokens || 1024,
    messages: chatMsgs,
    temperature: opts.temperature ?? 0.7,
  };
  if (systemMsgs.length > 0) {
    body.system = systemMsgs.map((m) => m.content).join("\n");
  }

  const { status, data } = await jsonPost(
    "https://api.anthropic.com/v1/messages",
    {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body
  );
  if (status !== 200) throw new Error(`Anthropic ${status}: ${JSON.stringify(data)}`);
  const text = data?.content?.[0]?.text || "";
  return { text, provider: "anthropic", model };
}

// ═══════════════════════════════════════════════════════════════════════
//  Router — picks the first available provider (or forced one)
// ═══════════════════════════════════════════════════════════════════════

const PROVIDERS = {
  ollama: ollamaChat,
  groq: groqChat,
  gemini: geminiChat,
  openai: openaiChat,
  anthropic: anthropicChat,
};

/**
 * Detect which providers have API keys configured.
 * @returns {string[]}
 */
function availableProviders() {
  const available = [];
  for (const name of DEFAULT_PROVIDER_ORDER) {
    if (isProviderConfigured(name)) available.push(name);
  }
  return available;
}

/**
 * Probe Ollama server and verify whether the configured model is installed.
 * @param {object} [opts] - { model?, timeout? }
 * @returns {Promise<{reachable:boolean, model:string, modelReady:boolean, installedModels?:string[], reason?:string}>}
 */
async function checkOllamaStatus(opts = {}) {
  const host = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
  const model = resolveModelForProvider("ollama", opts.model, "qwen2.5:14b-instruct");

  try {
    const { status, data } = await jsonGet(`${host}/api/tags`, {}, opts.timeout || 10000);
    if (status !== 200) {
      return {
        reachable: false,
        model,
        modelReady: false,
        reason: `HTTP ${status}`,
      };
    }

    const installedModels = Array.isArray(data?.models)
      ? data.models.map((m) => String(m?.model || m?.name || "")).filter(Boolean)
      : [];

    const target = normalizeModelName(model);
    const targetBase = stripModelTag(model);
    const modelReady = installedModels.some((m) => {
      const full = normalizeModelName(m);
      const base = stripModelTag(m);
      return full === target || base === targetBase;
    });

    return {
      reachable: true,
      model,
      modelReady,
      installedModels: installedModels.slice(0, 50),
    };
  } catch (err) {
    return {
      reachable: false,
      model,
      modelReady: false,
      reason: err.message,
    };
  }
}

/**
 * Send messages to the best available LLM provider.
 * @param {Array<{role:string,content:string}>} messages
 * @param {object} [opts] - { provider?, model?, maxTokens?, temperature? }
 * @returns {Promise<{text:string, provider:string, model:string}>}
 */
async function chat(messages, opts = {}) {
  const forcedRaw = normalizeModelName(opts.provider || process.env.AI_PROVIDER);
  const forced = forcedRaw && forcedRaw !== "auto" && PROVIDERS[forcedRaw] ? forcedRaw : null;
  const allowProviderFallback = opts.allowProviderFallback !== false;

  // Free providers first by default, but allow override with AI_PROVIDER_PRIORITY.
  const order = resolveProviderOrder(forced);
  const errors = [];
  const attempted = new Set();

  if (forced) {
    attempted.add(forced);
    if (!isProviderConfigured(forced)) {
      errors.push(`${forced}: provider not configured`);
      if (!allowProviderFallback) {
        throw new Error(`Forced AI provider "${forced}" is not configured`);
      }
    } else {
      try {
        return await PROVIDERS[forced](messages, opts);
      } catch (err) {
        errors.push(`${forced}: ${err.message}`);
        if (!allowProviderFallback) throw err;
      }
    }
  }

  for (const name of order) {
    if (attempted.has(name)) continue;
    if (!isProviderConfigured(name)) continue;

    const fn = PROVIDERS[name];

    try {
      return await fn(messages, opts);
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
    }
  }

  throw new Error(
    errors.length > 0
      ? `All AI providers failed:\n${errors.join("\n")}`
      : "No AI provider configured. Set AI_PROVIDER=ollama (or OLLAMA_HOST) for local Ollama, or configure a cloud API key."
  );
}

module.exports = { chat, availableProviders, checkOllamaStatus, PROVIDERS };
