// src/services/aiService.js
// ---------------------------------------------------------------------------
// Frontend AI service — calls the backend LLM proxy for high-quality AI
// responses.  Falls back to local rule-based analysis if the backend is
// unavailable or no provider is configured.
// ---------------------------------------------------------------------------

import { apiUrl } from "../utils/api";

const AI_BASE = apiUrl("api/ai");

/** Check if any AI provider is configured on the backend. */
export async function getAIStatus() {
  try {
    const res = await fetch(`${AI_BASE}/status`, { method: "GET" });
    if (!res.ok) return { configured: false, providers: [] };
    return await res.json();
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
  const res = await fetch(`${AI_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, sceneContext, provider, maxTokens, temperature }),
  });
  const data = await res.json();
  if (!data.success) {
    const err = new Error(data.message || "AI request failed");
    err.fallback = data.fallback;
    throw err;
  }
  return data;
}

/**
 * Request a scene description from the LLM.
 * @param {string} sceneContext - serialized scene summary
 * @returns {Promise<{text:string, provider:string, model:string}>}
 */
export async function aiDescribeScene(sceneContext) {
  const res = await fetch(`${AI_BASE}/describe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sceneContext }),
  });
  const data = await res.json();
  if (!data.success) {
    const err = new Error(data.message || "AI describe failed");
    err.fallback = data.fallback;
    throw err;
  }
  return data;
}

/**
 * Request material suggestions from the LLM.
 * @param {string} objectInfo - serialized object info
 * @param {string} [sceneContext] - optional scene context
 * @returns {Promise<{text:string, provider:string, model:string}>}
 */
export async function aiSuggestMaterial(objectInfo, sceneContext) {
  const res = await fetch(`${AI_BASE}/suggest-material`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objectInfo, sceneContext }),
  });
  const data = await res.json();
  if (!data.success) {
    const err = new Error(data.message || "AI material suggestion failed");
    err.fallback = data.fallback;
    throw err;
  }
  return data;
}

/**
 * Request name suggestions from the LLM.
 * @param {Array<{name:string, shape:string, color:string, surface:string, tris:number}>} objects
 * @returns {Promise<{text:string, provider:string, model:string}>}
 */
export async function aiSuggestNames(objects) {
  const res = await fetch(`${AI_BASE}/suggest-names`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objects }),
  });
  const data = await res.json();
  if (!data.success) {
    const err = new Error(data.message || "AI name suggestion failed");
    err.fallback = data.fallback;
    throw err;
  }
  return data;
}
