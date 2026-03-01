// src/__tests__/postfx-manager.test.js
// ---------------------------------------------------------------------------
// Phase 8 — Tests for PostFXManager
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------- THREE mock (minimal) ----------
vi.mock("three", () => ({
  NoToneMapping: 0,
  LinearToneMapping: 1,
  ReinhardToneMapping: 2,
  CineonToneMapping: 3,
  ACESFilmicToneMapping: 4,
  AgXToneMapping: 6,
}));

import * as PostFXManager from "../engine/PostFXManager.js";

beforeEach(() => {
  PostFXManager.resetAll();
});

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════════════════════ */

describe("PostFXManager — exports", () => {
  it("exports EFFECT_TYPES with all expected effects", () => {
    expect(PostFXManager.EFFECT_TYPES).toContain("bloom");
    expect(PostFXManager.EFFECT_TYPES).toContain("ssao");
    expect(PostFXManager.EFFECT_TYPES).toContain("dof");
    expect(PostFXManager.EFFECT_TYPES).toContain("outline");
    expect(PostFXManager.EFFECT_TYPES).toContain("chromaticAberration");
    expect(PostFXManager.EFFECT_TYPES).toContain("toneMapping");
    expect(PostFXManager.EFFECT_TYPES).toContain("colorGrading");
    expect(PostFXManager.EFFECT_TYPES).toContain("filmGrain");
    expect(PostFXManager.EFFECT_TYPES).toContain("vignette");
    expect(PostFXManager.EFFECT_TYPES.length).toBe(9);
  });

  it("exports TONEMAPPING_MODES with known modes", () => {
    const ids = PostFXManager.TONEMAPPING_MODES.map((m) => m.id);
    expect(ids).toContain("none");
    expect(ids).toContain("aces");
    expect(ids).toContain("reinhard");
    expect(ids).toContain("cineon");
    expect(PostFXManager.TONEMAPPING_MODES.length).toBeGreaterThanOrEqual(5);
  });

  it("exports COLOR_GRADING_PRESETS with expected presets", () => {
    const ids = PostFXManager.COLOR_GRADING_PRESETS.map((p) => p.id);
    expect(ids).toContain("none");
    expect(ids).toContain("warm");
    expect(ids).toContain("cool");
    expect(ids).toContain("vintage");
    expect(ids).toContain("noir");
    expect(ids).toContain("cyberpunk");
  });

  it("exports POSTFX_PRESETS with expected presets", () => {
    const ids = PostFXManager.POSTFX_PRESETS.map((p) => p.id);
    expect(ids).toContain("default");
    expect(ids).toContain("cinematic");
    expect(ids).toContain("stylized");
    expect(ids).toContain("clean");
    expect(ids).toContain("horror");
    expect(ids).toContain("arch-viz");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   DEFAULT CONFIG
   ═══════════════════════════════════════════════════════════════════════ */

describe("PostFXManager — getConfig / getEffectConfig", () => {
  it("returns full config with all 9 effects", () => {
    const cfg = PostFXManager.getConfig();
    expect(Object.keys(cfg).length).toBe(9);
    expect(cfg.bloom).toBeDefined();
    expect(cfg.ssao).toBeDefined();
    expect(cfg.vignette).toBeDefined();
  });

  it("returns individual effect config", () => {
    const bloom = PostFXManager.getEffectConfig("bloom");
    expect(bloom).toHaveProperty("strength");
    expect(bloom).toHaveProperty("radius");
    expect(bloom).toHaveProperty("threshold");
  });

  it("returns null for unknown effect", () => {
    expect(PostFXManager.getEffectConfig("nonexistent")).toBeNull();
  });

  it("default bloom is enabled, default SSAO is disabled", () => {
    expect(PostFXManager.isEffectEnabled("bloom")).toBe(true);
    expect(PostFXManager.isEffectEnabled("ssao")).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   UPDATE EFFECT
   ═══════════════════════════════════════════════════════════════════════ */

describe("PostFXManager — updateEffect", () => {
  it("updates bloom strength", () => {
    PostFXManager.updateEffect("bloom", { strength: 1.5 });
    expect(PostFXManager.getEffectConfig("bloom").strength).toBe(1.5);
  });

  it("updates multiple props at once", () => {
    PostFXManager.updateEffect("ssao", { radius: 0.8, intensity: 2.0 });
    const ssao = PostFXManager.getEffectConfig("ssao");
    expect(ssao.radius).toBe(0.8);
    expect(ssao.intensity).toBe(2.0);
  });

  it("ignores unknown effects", () => {
    PostFXManager.updateEffect("nonexistent", { foo: 1 });
    // should not throw
    expect(true).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ENABLE / DISABLE
   ═══════════════════════════════════════════════════════════════════════ */

describe("PostFXManager — setEffectEnabled / isEffectEnabled", () => {
  it("enables a disabled effect", () => {
    expect(PostFXManager.isEffectEnabled("ssao")).toBe(false);
    PostFXManager.setEffectEnabled("ssao", true);
    expect(PostFXManager.isEffectEnabled("ssao")).toBe(true);
  });

  it("disables an enabled effect", () => {
    PostFXManager.setEffectEnabled("bloom", false);
    expect(PostFXManager.isEffectEnabled("bloom")).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   RESET
   ═══════════════════════════════════════════════════════════════════════ */

describe("PostFXManager — resetEffect / resetAll", () => {
  it("resets a single effect to defaults", () => {
    PostFXManager.updateEffect("bloom", { strength: 99, threshold: 0 });
    PostFXManager.resetEffect("bloom");
    const bloom = PostFXManager.getEffectConfig("bloom");
    expect(bloom.strength).toBe(0.5);
    expect(bloom.threshold).toBe(0.8);
  });

  it("resetAll restores everything", () => {
    PostFXManager.setEffectEnabled("ssao", true);
    PostFXManager.updateEffect("bloom", { strength: 3 });
    PostFXManager.resetAll();
    expect(PostFXManager.isEffectEnabled("ssao")).toBe(false);
    expect(PostFXManager.getEffectConfig("bloom").strength).toBe(0.5);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   PRESETS
   ═══════════════════════════════════════════════════════════════════════ */

describe("PostFXManager — applyPreset", () => {
  it("applies cinematic preset", () => {
    PostFXManager.applyPreset("cinematic");
    const cfg = PostFXManager.getConfig();
    expect(cfg.bloom.enabled).toBe(true);
    expect(cfg.dof.enabled).toBe(true);
    expect(cfg.vignette.enabled).toBe(true);
    expect(cfg.filmGrain.enabled).toBe(true);
    expect(cfg.toneMapping.mode).toBe("aces");
    // SSAO not in cinematic preset — should be disabled
    expect(cfg.ssao.enabled).toBe(false);
  });

  it("applies clean preset — bloom off, ssao on", () => {
    PostFXManager.applyPreset("clean");
    const cfg = PostFXManager.getConfig();
    expect(cfg.bloom.enabled).toBe(false);
    expect(cfg.ssao.enabled).toBe(true);
  });

  it("ignores unknown preset", () => {
    const before = PostFXManager.getConfig();
    PostFXManager.applyPreset("nonexistent");
    const after = PostFXManager.getConfig();
    expect(after).toEqual(before);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   COLOR GRADING
   ═══════════════════════════════════════════════════════════════════════ */

describe("PostFXManager — applyColorGrading", () => {
  it("applies warm color grading", () => {
    PostFXManager.applyColorGrading("warm");
    const cg = PostFXManager.getEffectConfig("colorGrading");
    expect(cg.preset).toBe("warm");
    expect(cg.enabled).toBe(true);
    expect(cg.saturation).toBeGreaterThan(0);
  });

  it("applies 'none' preset without enabling", () => {
    PostFXManager.setEffectEnabled("colorGrading", false);
    PostFXManager.applyColorGrading("none");
    const cg = PostFXManager.getEffectConfig("colorGrading");
    expect(cg.preset).toBe("none");
    expect(cg.brightness).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   TONE MAPPING
   ═══════════════════════════════════════════════════════════════════════ */

describe("PostFXManager — applyToneMapping / getToneMappingValue", () => {
  it("returns ACES by default", () => {
    const v = PostFXManager.getToneMappingValue();
    expect(v).toBe(4); // ACESFilmicToneMapping
  });

  it("returns NoToneMapping when disabled", () => {
    PostFXManager.setEffectEnabled("toneMapping", false);
    expect(PostFXManager.getToneMappingValue()).toBe(0);
  });

  it("applies tone mapping to mock renderer", () => {
    const renderer = { toneMapping: 0, toneMappingExposure: 1.0 };
    PostFXManager.updateEffect("toneMapping", { mode: "cineon", exposure: 1.5 });
    PostFXManager.applyToneMapping(renderer);
    expect(renderer.toneMapping).toBe(3); // CineonToneMapping
    expect(renderer.toneMappingExposure).toBe(1.5);
  });

  it("applyToneMapping with disabled sets NoToneMapping", () => {
    const renderer = { toneMapping: 4, toneMappingExposure: 1.0 };
    PostFXManager.setEffectEnabled("toneMapping", false);
    PostFXManager.applyToneMapping(renderer);
    expect(renderer.toneMapping).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SUBSCRIBE
   ═══════════════════════════════════════════════════════════════════════ */

describe("PostFXManager — subscribe", () => {
  it("notifies listeners on update", () => {
    const cb = vi.fn();
    const unsub = PostFXManager.subscribe(cb);
    PostFXManager.updateEffect("bloom", { strength: 2 });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].bloom.strength).toBe(2);
    unsub();
  });

  it("does not notify after unsubscribe", () => {
    const cb = vi.fn();
    const unsub = PostFXManager.subscribe(cb);
    unsub();
    PostFXManager.updateEffect("bloom", { strength: 0.1 });
    expect(cb).not.toHaveBeenCalled();
  });
});
