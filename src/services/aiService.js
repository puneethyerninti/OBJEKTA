// src/services/aiService.js
// ---------------------------------------------------------------------------
// Frontend AI service — calls the backend LLM proxy for high-quality AI
// responses.  Falls back to local rule-based analysis if the backend is
// unavailable or no provider is configured.
// ---------------------------------------------------------------------------

import { apiUrl } from "../utils/api";

const AI_BASE = apiUrl("api/ai");

function getAuthHeaders() {
  const headers = { "Content-Type": "application/json" };
  try {
    const token = localStorage.getItem("objekta_token") || localStorage.getItem("token");
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch (e) {
    // ignore storage access errors
  }
  return headers;
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function requestAI(path, payload) {
  const res = await fetch(`${AI_BASE}${path}`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload || {}),
  });
  const data = await readJsonSafe(res);
  if (!res.ok || !data.success) {
    const err = new Error(data.message || `AI request failed (${res.status})`);
    err.status = res.status;
    err.fallback = data.fallback;
    err.requiresLLM = data.requiresLLM;
    throw err;
  }
  return data;
}

/** Check if any AI provider is configured on the backend. */
export async function getAIStatus() {
  try {
    const res = await fetch(`${AI_BASE}/status`, { method: "GET" });
    if (!res.ok) return { configured: false, providers: [] };
    return await readJsonSafe(res);
  } catch {
    return { configured: false, providers: [] };
  }
}

/**
 * Send a chat request to the backend LLM proxy.
 * @param {object} params
 * @param {Array<{role:string,content:string}>} params.messages
 * @param {string} [params.sceneContext] - serialized scene data
 * @param {string} [params.provider] - force provider
 * @param {number} [params.maxTokens]
 * @param {number} [params.temperature]
 * @returns {Promise<{text:string, provider:string, model:string}>}
 */
export async function aiChat({ messages, sceneContext, provider, maxTokens, temperature }) {
  return requestAI("/chat", { messages, sceneContext, provider, maxTokens, temperature });
}

/**
 * Request a scene description from the LLM.
 * @param {string} sceneContext - serialized scene summary
 * @returns {Promise<{text:string, provider:string, model:string}>}
 */
export async function aiDescribeScene(sceneContext) {
  return requestAI("/describe", { sceneContext });
}

/**
 * Request material suggestions from the LLM.
 * @param {string} objectInfo - serialized object info
 * @param {string} [sceneContext] - optional scene context
 * @returns {Promise<{text:string, provider:string, model:string}>}
 */
export async function aiSuggestMaterial(objectInfo, sceneContext) {
  return requestAI("/suggest-material", { objectInfo, sceneContext });
}

/**
 * Request name suggestions from the LLM.
 * @param {Array<{name:string, shape:string, color:string, surface:string, tris:number}>} objects
 * @returns {Promise<{text:string, provider:string, model:string}>}
 */
export async function aiSuggestNames(objects) {
  return requestAI("/suggest-names", { objects });
}
