// src/components/AIAssistantPanel.jsx
// ---------------------------------------------------------------------------
// AI Assistant tab for the right-side inspector panel.
// Provides: scene description, smart rename, material suggestions, Q&A chat,
// and optimization analysis — powered by LLM (Groq/Gemini/OpenAI/Claude)
// with rule-based fallback for offline use.
// ---------------------------------------------------------------------------

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { FiZap, FiRefreshCcw, FiSend, FiCheck, FiX, FiAlertTriangle, FiWifi, FiWifiOff } from "react-icons/fi";
import useAIStore from "../store/AIStore";
import {
  describeScene,
  suggestNames,
  suggestMaterial,
  askAboutScene,
  analyzeSceneOptimizations,
} from "../engine/AISceneAnalyzer";
import { getAIStatus } from "../services/aiService";

import "../styles/AIAssistant.css";

// ── Lightweight markdown renderer ─────────────────────────────────────
// Handles: **bold**, *italic*, `code`, • bullets, numbered lists, newlines, emojis
function renderMd(text) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i > 0) elements.push(<br key={`br-${i}`} />);
    // Bullet points
    const bulletMatch = line.match(/^(\s*)[•\-*]\s+(.*)/);
    if (bulletMatch) {
      elements.push(<span key={`li-${i}`} className="ai-md-bullet">{inlineFormat(bulletMatch[2], i)}</span>);
      continue;
    }
    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      elements.push(<span key={`ol-${i}`} className="ai-md-num"><strong>{numMatch[1]}.</strong> {inlineFormat(numMatch[2], i)}</span>);
      continue;
    }
    elements.push(<span key={`l-${i}`}>{inlineFormat(line, i)}</span>);
  }
  return elements;
}

function inlineFormat(text, lineIdx) {
  // Process **bold**, *italic*, `code` inline
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let match;
  let partIdx = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[2]) parts.push(<strong key={`b-${lineIdx}-${partIdx++}`}>{match[2]}</strong>);
    else if (match[3]) parts.push(<em key={`i-${lineIdx}-${partIdx++}`}>{match[3]}</em>);
    else if (match[4]) parts.push(<code key={`c-${lineIdx}-${partIdx++}`} className="ai-md-code">{match[4]}</code>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
}

export default function AIAssistantPanel({ workspaceRef, selected, pushToast }) {
  // ── AI Store subscriptions ───────────────────────────────────────
  const status = useAIStore((s) => s.status);
  const statusMessage = useAIStore((s) => s.statusMessage);
  const chatHistory = useAIStore((s) => s.chatHistory);
  const suggestions = useAIStore((s) => s.suggestions);
  const results = useAIStore((s) => s.results);

  // ── Local state ──────────────────────────────────────────────────
  const [chatInput, setChatInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiMode, setAIMode] = useState({ online: false, provider: null, model: null });
  const chatEndRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // Check AI backend status on mount
  useEffect(() => {
    let cancelled = false;
    getAIStatus().then((data) => {
      if (!cancelled) {
        const hasProviders = data.configured === true;
        const provider = data.activeProvider || (data.pythonService ? "python" : null);
        setAIMode({ online: hasProviders, provider, model: data.model || null });
      }
    }).catch(() => {
      if (!cancelled) setAIMode({ online: false, provider: null, model: null });
    });
    return () => { cancelled = true; };
  }, []);

  // ── Helpers to get scene data ────────────────────────────────────
  const getSceneData = useCallback(() => {
    const ws = workspaceRef?.current;
    if (!ws) return { children: [], scene: null };
    const children = ws.getSceneObjects?.() || [];
    const scene = ws.scene || null;
    return { children, scene };
  }, [workspaceRef]);

  // ── Action handlers ──────────────────────────────────────────────
  const handleDescribe = useCallback(async () => {
    setBusy(true);
    try {
      const { children, scene } = getSceneData();
      await describeScene(children, scene);
    } catch (e) {
      pushToast?.({ type: "error", message: `AI error: ${e.message}` });
    } finally {
      setBusy(false);
    }
  }, [getSceneData, pushToast]);

  const handleSmartRename = useCallback(async () => {
    setBusy(true);
    try {
      const { children } = getSceneData();
      const names = await suggestNames(children);
      if (names.length === 0) {
        pushToast?.({ type: "info", message: "All objects already have descriptive names!" });
      }
    } catch (e) {
      pushToast?.({ type: "error", message: `AI error: ${e.message}` });
    } finally {
      setBusy(false);
    }
  }, [getSceneData, pushToast]);

  const handleMaterialSuggest = useCallback(async () => {
    if (!selected) {
      pushToast?.({ type: "warning", message: "Select an object first" });
      return;
    }
    setBusy(true);
    try {
      await suggestMaterial(selected);
    } catch (e) {
      pushToast?.({ type: "error", message: `AI error: ${e.message}` });
    } finally {
      setBusy(false);
    }
  }, [selected, pushToast]);

  const handleAnalyze = useCallback(async () => {
    setBusy(true);
    try {
      const { children, scene } = getSceneData();
      const suggestions = await analyzeSceneOptimizations(children, scene);
      if (suggestions.length === 0) {
        pushToast?.({ type: "info", message: "Scene looks optimized!" });
      }
    } catch (e) {
      pushToast?.({ type: "error", message: `AI error: ${e.message}` });
    } finally {
      setBusy(false);
    }
  }, [getSceneData, pushToast]);

  const handleAsk = useCallback(async () => {
    const q = chatInput.trim();
    if (!q) return;
    setChatInput("");
    setBusy(true);
    try {
      const { children, scene } = getSceneData();
      await askAboutScene(q, children, scene);
    } catch (e) {
      pushToast?.({ type: "error", message: `AI error: ${e.message}` });
    } finally {
      setBusy(false);
    }
  }, [chatInput, getSceneData, pushToast]);

  const handleApplyName = useCallback(
    (uuid, name) => {
      const ws = workspaceRef?.current;
      if (!ws) return;
      const objs = ws.getSceneObjects?.() || [];
      const obj = objs.find((o) => o.uuid === uuid);
      if (obj) {
        obj.name = name;
        pushToast?.({ type: "info", message: `Renamed to "${name}"` });
        useAIStore.getState().applySuggestion(uuid);
      }
    },
    [workspaceRef, pushToast],
  );

  const handleDismissSuggestion = useCallback((id) => {
    useAIStore.getState().dismissSuggestion(id);
  }, []);

  const loading = status === "loading" || busy;
  const sceneDesc = results.sceneDescription;
  const namesSuggestions = results.namesSuggestions;
  const materialSuggestion = results.materialSuggestion;

  return (
    <div className="ai-assistant-panel">
      {/* Status bar */}
      <div className={`ai-status-bar ai-status--${status}`}>
        <FiZap className="ai-status-icon" />
        <span className="ai-status-text">
          {statusMessage || (status === "idle" ? "AI Assistant — click an action below" : status)}
        </span>
        {loading && <span className="ai-spinner" />}
      </div>

      {/* AI mode indicator */}
      <div className={`ai-mode-indicator ${aiMode.online ? "ai-mode--online" : "ai-mode--offline"}`}>
        {aiMode.online ? <FiWifi /> : <FiWifiOff />}
        <span>
          {aiMode.online
            ? `LLM: ${aiMode.provider || "connected"}${aiMode.model ? ` (${aiMode.model})` : ""}`
            : "Offline mode — local analysis only"}
        </span>
      </div>

      {/* Quick actions */}
      <div className="ai-actions">
        <button className="studio-btn ai-action-btn" onClick={handleDescribe} disabled={loading} title="AI describes your scene">
          <FiZap /> Describe Scene
        </button>
        <button className="studio-btn ai-action-btn" onClick={handleSmartRename} disabled={loading} title="Suggest better names for generic objects">
          <FiRefreshCcw /> Smart Rename
        </button>
        <button className="studio-btn ai-action-btn" onClick={handleMaterialSuggest} disabled={loading || !selected} title="AI suggests PBR material values">
          <FiZap /> Suggest Material
        </button>
        <button className="studio-btn ai-action-btn" onClick={handleAnalyze} disabled={loading} title="Check for optimization opportunities">
          <FiAlertTriangle /> Analyze Scene
        </button>
      </div>

      {/* Scene description result */}
      {sceneDesc && (
        <div className="ai-result-card">
          <div className="panel-title">Scene Description</div>
          <div className="ai-result-text">{renderMd(sceneDesc)}</div>
        </div>
      )}

      {/* Name suggestions */}
      {namesSuggestions && namesSuggestions.length > 0 && (
        <div className="ai-result-card">
          <div className="panel-title">Name Suggestions</div>
          <ul className="ai-names-list">
            {namesSuggestions.map((n) => (
              <li key={n.uuid} className="ai-name-item">
                <span className="ai-name-current">{n.currentName || "(unnamed)"}</span>
                <span className="ai-name-arrow">&rarr;</span>
                <span className="ai-name-suggested">{n.suggestedName}</span>
                <button
                  className="studio-btn ai-apply-btn"
                  onClick={() => handleApplyName(n.uuid, n.suggestedName)}
                  title="Apply this name"
                >
                  <FiCheck />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Material suggestion */}
      {materialSuggestion && (
        <div className="ai-result-card">
          <div className="panel-title">Material Suggestion</div>
          <p className="ai-result-text">{renderMd(materialSuggestion.description)}</p>
          <div className="ai-material-values">
            {materialSuggestion.roughness != null && (
              <span className="ai-mat-chip">Roughness: {materialSuggestion.roughness.toFixed(2)}</span>
            )}
            {materialSuggestion.metalness != null && (
              <span className="ai-mat-chip">Metalness: {materialSuggestion.metalness.toFixed(2)}</span>
            )}
            {materialSuggestion.colorHex && (
              <span className="ai-mat-chip">
                Color: <span className="ai-color-swatch" style={{ background: materialSuggestion.colorHex }} /> {materialSuggestion.colorHex}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Optimization suggestions */}
      {suggestions.length > 0 && (
        <div className="ai-result-card">
          <div className="panel-title">Suggestions ({suggestions.length})</div>
          <ul className="ai-suggestions-list">
            {suggestions.map((s) => (
              <li key={s.id} className={`ai-suggestion-item ${s.applied ? "applied" : ""}`}>
                <span className="ai-suggestion-text">{renderMd(s.summary)}</span>
                <button
                  className="studio-btn ai-dismiss-btn"
                  onClick={() => handleDismissSuggestion(s.id)}
                  title="Dismiss"
                >
                  <FiX />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Chat */}
      <div className="ai-chat-section">
        <div className="panel-title">Ask about your scene</div>
        <div className="ai-chat-history">
          {chatHistory.length === 0 && (
            <div className="panel-empty">Ask anything about your scene — the AI has full context.</div>
          )}
          {chatHistory.map((msg, i) => (
            <div key={i} className={`ai-chat-msg ai-chat-msg--${msg.role}`}>
              <span className="ai-chat-role">{msg.role === "user" ? "You" : "AI"}</span>
              <span className="ai-chat-content">{renderMd(msg.content)}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="ai-chat-input-row">
          <input
            className="studio-input ai-chat-input"
            placeholder="e.g. How can I improve the lighting?"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            disabled={loading}
            aria-label="Ask AI about your scene"
          />
          <button
            className="launch-btn ai-send-btn"
            onClick={handleAsk}
            disabled={loading || !chatInput.trim()}
            title="Send"
          >
            <FiSend />
          </button>
        </div>
      </div>
    </div>
  );
}
