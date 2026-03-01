// src/__tests__/ai-store.test.js
// Unit tests for AIStore (Zustand) state management.

import { describe, it, expect, beforeEach } from "vitest";
import useAIStore from "../store/AIStore";

describe("AIStore", () => {
  beforeEach(() => {
    useAIStore.getState().reset();
  });

  it("starts in idle state", () => {
    const s = useAIStore.getState();
    expect(s.status).toBe("idle");
    expect(s.chatHistory).toEqual([]);
    expect(s.suggestions).toEqual([]);
    expect(s.results).toEqual({});
  });

  it("setStatus updates status and message", () => {
    useAIStore.getState().setStatus("loading", "Downloading model…");
    const s = useAIStore.getState();
    expect(s.status).toBe("loading");
    expect(s.statusMessage).toBe("Downloading model…");
  });

  it("setModelStatus tracks per-model state", () => {
    useAIStore.getState().setModelStatus("text-gen", { status: "loading", progress: 42 });
    const m = useAIStore.getState().models["text-gen"];
    expect(m.status).toBe("loading");
    expect(m.progress).toBe(42);
  });

  it("setResult / clearResult work correctly", () => {
    useAIStore.getState().setResult("sceneDescription", "A cube on a plane");
    expect(useAIStore.getState().results.sceneDescription).toBe("A cube on a plane");

    useAIStore.getState().clearResult("sceneDescription");
    expect(useAIStore.getState().results.sceneDescription).toBeUndefined();
  });

  it("pushMessage appends to chatHistory with timestamp", () => {
    useAIStore.getState().pushMessage("user", "Hello");
    useAIStore.getState().pushMessage("assistant", "Hi there");
    const h = useAIStore.getState().chatHistory;
    expect(h).toHaveLength(2);
    expect(h[0].role).toBe("user");
    expect(h[0].content).toBe("Hello");
    expect(typeof h[0].timestamp).toBe("number");
    expect(h[1].role).toBe("assistant");
  });

  it("clearChat empties history", () => {
    useAIStore.getState().pushMessage("user", "test");
    useAIStore.getState().clearChat();
    expect(useAIStore.getState().chatHistory).toEqual([]);
  });

  it("addSuggestions deduplicates by id", () => {
    const s1 = { id: "a", category: "general", summary: "Do X", payload: null, applied: false };
    const s2 = { id: "b", category: "general", summary: "Do Y", payload: null, applied: false };
    useAIStore.getState().addSuggestions([s1, s2]);
    useAIStore.getState().addSuggestions([s1]); // duplicate
    expect(useAIStore.getState().suggestions).toHaveLength(2);
  });

  it("applySuggestion marks a suggestion as applied", () => {
    useAIStore.getState().addSuggestions([
      { id: "x", category: "optimization", summary: "Decimate", payload: null, applied: false },
    ]);
    useAIStore.getState().applySuggestion("x");
    expect(useAIStore.getState().suggestions[0].applied).toBe(true);
  });

  it("dismissSuggestion removes it from the list", () => {
    useAIStore.getState().addSuggestions([
      { id: "x", category: "optimization", summary: "Decimate", payload: null, applied: false },
    ]);
    useAIStore.getState().dismissSuggestion("x");
    expect(useAIStore.getState().suggestions).toHaveLength(0);
  });

  it("reset returns to initial state", () => {
    useAIStore.getState().setStatus("ready", "OK");
    useAIStore.getState().pushMessage("user", "hello");
    useAIStore.getState().setResult("test", 123);
    useAIStore.getState().addSuggestions([{ id: "a", category: "general", summary: "X", payload: null, applied: false }]);

    useAIStore.getState().reset();
    const s = useAIStore.getState();
    expect(s.status).toBe("idle");
    expect(s.chatHistory).toEqual([]);
    expect(s.results).toEqual({});
    expect(s.suggestions).toEqual([]);
  });
});
