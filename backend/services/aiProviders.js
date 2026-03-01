// backend/services/aiProviders.js
// ---------------------------------------------------------------------------
// Multi-provider LLM adapter.  Each provider is a thin wrapper that accepts
// a messages array [{role, content}] and returns { text, provider, model }.
//
// Supported (in priority order):
//   1. Groq          — free tier, fast (Llama 3 / Mixtral)
//   2. Google Gemini  — free tier (gemini-1.5-flash)
//   3. OpenAI         — paid (gpt-4o-mini / gpt-4o)
//   4. Anthropic      — paid (claude-3.5-sonnet)
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

// ═══════════════════════════════════════════════════════════════════════
//  Provider adapters
// ═══════════════════════════════════════════════════════════════════════

/** Groq (free tier — Llama 3 70B / Mixtral) */
async function groqChat(messages, opts = {}) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");
  const model = opts.model || process.env.AI_MODEL || "llama-3.3-70b-versatile";
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
  const model = opts.model || process.env.AI_MODEL || "gemini-2.0-flash";

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
  const model = opts.model || process.env.AI_MODEL || "gpt-4o-mini";
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
  const model = opts.model || process.env.AI_MODEL || "claude-sonnet-4-20250514";
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
  if (process.env.GROQ_API_KEY) available.push("groq");
  if (process.env.GEMINI_API_KEY) available.push("gemini");
  if (process.env.OPENAI_API_KEY) available.push("openai");
  if (process.env.ANTHROPIC_API_KEY) available.push("anthropic");
  return available;
}

/**
 * Send messages to the best available LLM provider.
 * @param {Array<{role:string,content:string}>} messages
 * @param {object} [opts] - { provider?, model?, maxTokens?, temperature? }
 * @returns {Promise<{text:string, provider:string, model:string}>}
 */
async function chat(messages, opts = {}) {
  // If a specific provider is forced
  const forced = opts.provider || process.env.AI_PROVIDER;
  if (forced && PROVIDERS[forced]) {
    return PROVIDERS[forced](messages, opts);
  }

  // Try in priority order: groq → gemini → openai → anthropic
  const order = ["groq", "gemini", "openai", "anthropic"];
  const errors = [];

  for (const name of order) {
    const fn = PROVIDERS[name];
    const keyMap = {
      groq: "GROQ_API_KEY",
      gemini: "GEMINI_API_KEY",
      openai: "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
    };
    if (!process.env[keyMap[name]]) continue; // skip unconfigured

    try {
      return await fn(messages, opts);
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
    }
  }

  throw new Error(
    errors.length > 0
      ? `All AI providers failed:\n${errors.join("\n")}`
      : "No AI provider configured. Set at least one API key: GROQ_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY."
  );
}

module.exports = { chat, availableProviders, PROVIDERS };
