// src/components/AIChatPanel.jsx
// ---------------------------------------------------------------------------
// Standalone ChatGPT-style AI chat panel — floating overlay on the Studio page.
// Provides: conversational chat, scene description, smart rename, material
// suggestions, and optimization analysis.
// ---------------------------------------------------------------------------

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  FiMessageSquare, FiX, FiSend, FiZap, FiRefreshCcw,
  FiCheck, FiAlertTriangle, FiTrash2, FiMaximize2, FiMinimize2,
} from "react-icons/fi";
import useAIStore from "../store/AIStore";
import {
  describeScene,
  suggestNames,
  suggestMaterial,
  askAboutScene,
  analyzeSceneOptimizations,
} from "../engine/AISceneAnalyzer";
import { getAIStatus } from "../services/aiService";

import "../styles/AIChatPanel.css";

// ── Markdown renderer ─────────────────────────────────────────────────
function renderMd(text) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i > 0) elements.push(<br key={`br-${i}`} />);
    if (!line.trim()) continue;
    const bulletMatch = line.match(/^(\s*)[•\-*]\s+(.*)/);
    if (bulletMatch) {
      elements.push(<span key={`li-${i}`} className="aichat-md-bullet">{inlineFmt(bulletMatch[2], i)}</span>);
      continue;
    }
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      elements.push(<span key={`ol-${i}`} className="aichat-md-num"><strong>{numMatch[1]}.</strong> {inlineFmt(numMatch[2], i)}</span>);
      continue;
    }
    elements.push(<span key={`l-${i}`}>{inlineFmt(line, i)}</span>);
  }
  return elements;
}

function inlineFmt(text, lineIdx) {
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0, match, idx = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[2]) parts.push(<strong key={`b-${lineIdx}-${idx++}`}>{match[2]}</strong>);
    else if (match[3]) parts.push(<em key={`i-${lineIdx}-${idx++}`}>{match[3]}</em>);
    else if (match[4]) parts.push(<code key={`c-${lineIdx}-${idx++}`} className="aichat-md-code">{match[4]}</code>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
}

// ── Quick action chips ────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { id: "describe",  icon: <FiZap />,            label: "Describe Scene" },
  { id: "rename",    icon: <FiRefreshCcw />,      label: "Smart Rename" },
  { id: "material",  icon: <FiZap />,            label: "Suggest Material" },
  { id: "analyze",   icon: <FiAlertTriangle />,   label: "Analyze Scene" },
];

// ═══════════════════════════════════════════════════════════════════════
export default function AIChatPanel({ workspaceRef, selected, pushToast }) {
  // ── Store ────────────────────────────────────────────────────────
  const status = useAIStore((s) => s.status);
  const chatHistory = useAIStore((s) => s.chatHistory);
  const suggestions = useAIStore((s) => s.suggestions);
  const results = useAIStore((s) => s.results);

  // ── Local state ──────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiMode, setAIMode] = useState({ online: false, provider: null });
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // ── Auto-scroll ──────────────────────────────────────────────────
  useEffect(() => {
    if (open) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, open]);

  // ── Focus input when opened ──────────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // ── Check AI backend ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    getAIStatus().then((data) => {
      if (!cancelled) {
        const strictLLM = data?.strictLLM === true;
        const llmReady = data?.llmReady == null ? data?.configured === true : data.llmReady === true;
        const hasProviders = llmReady || (!strictLLM && data?.configured === true);
        const provider = data.activeProvider || (data.pythonService ? "python" : null);
        setAIMode({ online: hasProviders, provider: hasProviders ? provider : null });
      }
    }).catch(() => {
      if (!cancelled) setAIMode({ online: false, provider: null });
    });
    return () => { cancelled = true; };
  }, []);

  // ── Scene data helper ────────────────────────────────────────────
  const getSceneData = useCallback(() => {
    const ws = workspaceRef?.current;
    if (!ws) return { children: [], scene: null };
    return { children: ws.getSceneObjects?.() || [], scene: ws.scene || null };
  }, [workspaceRef]);

  // ── Chat handler ─────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
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

  // ── Quick action handlers ────────────────────────────────────────
  const handleQuickAction = useCallback(async (actionId) => {
    setBusy(true);
    try {
      const { children, scene } = getSceneData();
      switch (actionId) {
        case "describe":
          await describeScene(children, scene);
          break;
        case "rename": {
          const names = await suggestNames(children);
          if (names.length === 0) pushToast?.({ type: "info", message: "All objects already have descriptive names!" });
          break;
        }
        case "material":
          if (!selected) { pushToast?.({ type: "warning", message: "Select an object first" }); break; }
          await suggestMaterial(selected);
          break;
        case "analyze":
          await analyzeSceneOptimizations(children, scene);
          break;
      }
    } catch (e) {
      pushToast?.({ type: "error", message: `AI error: ${e.message}` });
    } finally {
      setBusy(false);
    }
  }, [getSceneData, selected, pushToast]);

  // ── Apply name helper ────────────────────────────────────────────
  const handleApplyName = useCallback((uuid, name) => {
    const ws = workspaceRef?.current;
    if (!ws) return;
    const objs = ws.getSceneObjects?.() || [];
    const obj = objs.find((o) => o.uuid === uuid);
    if (obj) {
      obj.name = name;
      pushToast?.({ type: "info", message: `Renamed to "${name}"` });
      useAIStore.getState().applySuggestion(uuid);
    }
  }, [workspaceRef, pushToast]);

  const handleClearChat = useCallback(() => {
    useAIStore.getState().clearChat();
    useAIStore.getState().clearSuggestions();
    useAIStore.getState().clearResult("sceneDescription");
    useAIStore.getState().clearResult("namesSuggestions");
    useAIStore.getState().clearResult("materialSuggestion");
  }, []);

  const loading = status === "loading" || busy;
  const sceneDesc = results.sceneDescription;
  const namesSuggestions = results.namesSuggestions;
  const materialSuggestion = results.materialSuggestion;
  const hasResults = sceneDesc || (namesSuggestions?.length > 0) || materialSuggestion || suggestions.length > 0;

  // ── FAB (Floating Action Button) when closed ─────────────────────
  if (!open) {
    return (
      <button
        className="aichat-fab"
        onClick={() => setOpen(true)}
        title="Open AI Assistant"
        aria-label="Open AI Assistant"
      >
        <FiMessageSquare />
        {aiMode.online && <span className="aichat-fab-dot" />}
      </button>
    );
  }

  // ── Full chat panel ──────────────────────────────────────────────
  return (
    <div className={`aichat-panel ${expanded ? "aichat-panel--expanded" : ""}`}>
      {/* Header */}
      <div className="aichat-header">
        <div className="aichat-header-left">
          <FiMessageSquare className="aichat-header-icon" />
          <span className="aichat-header-title">Objekta AI</span>
          <span className={`aichat-status-dot ${aiMode.online ? "online" : "offline"}`} />
          <span className="aichat-header-provider">
            {aiMode.online ? aiMode.provider || "LLM" : "offline"}
          </span>
        </div>
        <div className="aichat-header-actions">
          {(chatHistory.length > 0 || hasResults) && (
            <button className="aichat-hdr-btn" onClick={handleClearChat} title="Clear chat">
              <FiTrash2 />
            </button>
          )}
          <button className="aichat-hdr-btn" onClick={() => setExpanded(!expanded)} title={expanded ? "Minimize" : "Expand"}>
            {expanded ? <FiMinimize2 /> : <FiMaximize2 />}
          </button>
          <button className="aichat-hdr-btn" onClick={() => setOpen(false)} title="Close">
            <FiX />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="aichat-messages">
        {/* Welcome message when empty */}
        {chatHistory.length === 0 && !hasResults && (
          <div className="aichat-welcome">
            <div className="aichat-welcome-icon">
              <FiZap />
            </div>
            <h3 className="aichat-welcome-title">Hi! I'm Objekta AI</h3>
            <p className="aichat-welcome-desc">
              Your 3D scene assistant. Ask me anything about your scene, or use the quick actions below.
            </p>
          </div>
        )}

        {/* Scene description result */}
        {sceneDesc && (
          <div className="aichat-result-card">
            <div className="aichat-result-label">Scene Description</div>
            <div className="aichat-result-body">{renderMd(sceneDesc)}</div>
          </div>
        )}

        {/* Name suggestions */}
        {namesSuggestions && namesSuggestions.length > 0 && (
          <div className="aichat-result-card">
            <div className="aichat-result-label">Name Suggestions</div>
            <div className="aichat-names-list">
              {namesSuggestions.map((n) => (
                <div key={n.uuid} className="aichat-name-row">
                  <span className="aichat-name-old">{n.currentName || "(unnamed)"}</span>
                  <span className="aichat-name-arrow">→</span>
                  <span className="aichat-name-new">{n.suggestedName}</span>
                  <button className="aichat-name-apply" onClick={() => handleApplyName(n.uuid, n.suggestedName)} title="Apply">
                    <FiCheck />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Material suggestion */}
        {materialSuggestion && (
          <div className="aichat-result-card">
            <div className="aichat-result-label">Material Suggestion</div>
            <div className="aichat-result-body">{renderMd(materialSuggestion.description)}</div>
            <div className="aichat-mat-chips">
              {materialSuggestion.roughness != null && (
                <span className="aichat-chip">Roughness: {materialSuggestion.roughness.toFixed(2)}</span>
              )}
              {materialSuggestion.metalness != null && (
                <span className="aichat-chip">Metalness: {materialSuggestion.metalness.toFixed(2)}</span>
              )}
              {materialSuggestion.colorHex && (
                <span className="aichat-chip">
                  <span className="aichat-color-dot" style={{ background: materialSuggestion.colorHex }} />
                  {materialSuggestion.colorHex}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Optimization suggestions */}
        {suggestions.length > 0 && (
          <div className="aichat-result-card">
            <div className="aichat-result-label">Optimization ({suggestions.length})</div>
            {suggestions.map((s) => (
              <div key={s.id} className={`aichat-suggestion ${s.applied ? "applied" : ""}`}>
                <span className="aichat-suggestion-text">{renderMd(s.summary)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Chat messages */}
        {chatHistory.map((msg, i) => (
          <div key={i} className={`aichat-msg aichat-msg--${msg.role}`}>
            <div className="aichat-msg-avatar">
              {msg.role === "user" ? "You" : "AI"}
            </div>
            <div className="aichat-msg-content">
              {renderMd(msg.content)}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="aichat-msg aichat-msg--assistant">
            <div className="aichat-msg-avatar">AI</div>
            <div className="aichat-msg-content">
              <span className="aichat-typing">
                <span /><span /><span />
              </span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Quick actions bar */}
      <div className="aichat-quick-actions">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.id}
            className="aichat-quick-btn"
            onClick={() => handleQuickAction(a.id)}
            disabled={loading}
            title={a.label}
          >
            {a.icon}
            <span>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="aichat-input-area">
        <input
          ref={inputRef}
          className="aichat-input"
          placeholder="Ask anything about your scene..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={loading}
          aria-label="Chat with AI"
        />
        <button
          className="aichat-send-btn"
          onClick={handleSend}
          disabled={loading || !chatInput.trim()}
          title="Send"
        >
          <FiSend />
        </button>
      </div>
    </div>
  );
}
