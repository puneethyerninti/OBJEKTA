// src/__tests__/environment-manager.test.js
// ---------------------------------------------------------------------------
// Phase 8 — Tests for EnvironmentManager
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------- THREE mock (minimal) ----------
vi.mock("three", () => {
  class Color {
    constructor(c) { this._c = c; }
  }
  class Fog {
    constructor(color, near, far) { this.color = color; this.near = near; this.far = far; this.isFog = true; }
  }
  class FogExp2 {
    constructor(color, density) { this.color = color; this.density = density; this.isFogExp2 = true; }
  }
  class PlaneGeometry {
    constructor(w, h) { this.w = w; this.h = h; }
  }
  class ShadowMaterial {
    constructor(opts) { Object.assign(this, opts); }
  }
  class Mesh {
    constructor(geom, mat) {
      this.geometry = geom;
      this.material = mat;
      this.rotation = { x: 0, y: 0, z: 0 };
      this.receiveShadow = false;
      this.name = "";
      this.userData = {};
    }
  }
  return { Color, Fog, FogExp2, PlaneGeometry, ShadowMaterial, Mesh };
});

import * as EnvironmentManager from "../engine/EnvironmentManager.js";

beforeEach(() => {
  EnvironmentManager.resetAll();
});

/* ═══════════════════════════════════════════════════════════════════════════
   PRESETS
   ═══════════════════════════════════════════════════════════════════════ */

describe("EnvironmentManager — ENV_PRESETS", () => {
  it("has at least 7 presets", () => {
    expect(EnvironmentManager.ENV_PRESETS.length).toBeGreaterThanOrEqual(7);
  });

  it("each preset has required fields", () => {
    for (const p of EnvironmentManager.ENV_PRESETS) {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("label");
      expect(p).toHaveProperty("backgroundColor");
      expect(p).toHaveProperty("ambientColor");
      expect(p).toHaveProperty("fog");
      expect(p.fog).toHaveProperty("enabled");
      expect(p.fog).toHaveProperty("type");
    }
  });

  it("includes studio, sunset, night, custom presets", () => {
    const ids = EnvironmentManager.ENV_PRESETS.map((p) => p.id);
    expect(ids).toContain("studio");
    expect(ids).toContain("sunset");
    expect(ids).toContain("night");
    expect(ids).toContain("custom");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   DEFAULT STATE
   ═══════════════════════════════════════════════════════════════════════ */

describe("EnvironmentManager — default state", () => {
  it("starts with studio preset", () => {
    expect(EnvironmentManager.getPresetId()).toBe("studio");
  });

  it("getState returns full state object", () => {
    const st = EnvironmentManager.getState();
    expect(st).toHaveProperty("preset", "studio");
    expect(st).toHaveProperty("backgroundColor");
    expect(st).toHaveProperty("ambientColor");
    expect(st).toHaveProperty("ambientIntensity");
    expect(st).toHaveProperty("envMapIntensity");
    expect(st).toHaveProperty("envRotation");
    expect(st).toHaveProperty("fog");
    expect(st).toHaveProperty("groundPlane");
    expect(st).toHaveProperty("groundColor");
  });

  it("fog is disabled by default (studio)", () => {
    expect(EnvironmentManager.getState().fog.enabled).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   APPLY PRESET
   ═══════════════════════════════════════════════════════════════════════ */

describe("EnvironmentManager — applyPreset", () => {
  it("applies sunset preset", () => {
    EnvironmentManager.applyPreset("sunset");
    const st = EnvironmentManager.getState();
    expect(st.preset).toBe("sunset");
    expect(st.fog.enabled).toBe(true);
    expect(st.groundPlane).toBe(true);
  });

  it("applies night preset", () => {
    EnvironmentManager.applyPreset("night");
    const st = EnvironmentManager.getState();
    expect(st.preset).toBe("night");
    expect(st.ambientIntensity).toBe(0.15);
    expect(st.fog.enabled).toBe(true);
  });

  it("ignores unknown preset", () => {
    const before = EnvironmentManager.getState();
    EnvironmentManager.applyPreset("nonexistent");
    expect(EnvironmentManager.getState()).toEqual(before);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SETTERS
   ═══════════════════════════════════════════════════════════════════════ */

describe("EnvironmentManager — setters", () => {
  it("setBackgroundColor changes color and sets preset to custom", () => {
    EnvironmentManager.setBackgroundColor("#ff0000");
    const st = EnvironmentManager.getState();
    expect(st.backgroundColor).toBe("#ff0000");
    expect(st.preset).toBe("custom");
  });

  it("setAmbientColor changes color", () => {
    EnvironmentManager.setAmbientColor("#00ff00");
    expect(EnvironmentManager.getState().ambientColor).toBe("#00ff00");
  });

  it("setAmbientIntensity clamps to [0, 2]", () => {
    EnvironmentManager.setAmbientIntensity(5);
    expect(EnvironmentManager.getState().ambientIntensity).toBe(2);
    EnvironmentManager.setAmbientIntensity(-1);
    expect(EnvironmentManager.getState().ambientIntensity).toBe(0);
  });

  it("setEnvMapIntensity clamps to [0, 3]", () => {
    EnvironmentManager.setEnvMapIntensity(10);
    expect(EnvironmentManager.getState().envMapIntensity).toBe(3);
  });

  it("setEnvRotation wraps around 360", () => {
    EnvironmentManager.setEnvRotation(400);
    expect(EnvironmentManager.getState().envRotation).toBe(40);
    EnvironmentManager.setEnvRotation(-30);
    expect(EnvironmentManager.getState().envRotation).toBe(330);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   FOG
   ═══════════════════════════════════════════════════════════════════════ */

describe("EnvironmentManager — fog controls", () => {
  it("setFogEnabled toggles fog", () => {
    EnvironmentManager.setFogEnabled(true);
    expect(EnvironmentManager.getState().fog.enabled).toBe(true);
    EnvironmentManager.setFogEnabled(false);
    expect(EnvironmentManager.getState().fog.enabled).toBe(false);
  });

  it("setFogType changes type", () => {
    EnvironmentManager.setFogType("exponential");
    expect(EnvironmentManager.getState().fog.type).toBe("exponential");
  });

  it("setFogType rejects invalid type", () => {
    EnvironmentManager.setFogType("invalid");
    expect(EnvironmentManager.getState().fog.type).toBe("linear"); // unchanged
  });

  it("setFogColor changes color", () => {
    EnvironmentManager.setFogColor("#123456");
    expect(EnvironmentManager.getState().fog.color).toBe("#123456");
  });

  it("setFogNear clamps minimum to 0", () => {
    EnvironmentManager.setFogNear(-5);
    expect(EnvironmentManager.getState().fog.near).toBe(0);
  });

  it("setFogFar ensures far > near", () => {
    EnvironmentManager.setFogNear(20);
    EnvironmentManager.setFogFar(15);
    expect(EnvironmentManager.getState().fog.far).toBe(21); // near + 1
  });

  it("setFogDensity clamps to [0.001, 1]", () => {
    EnvironmentManager.setFogDensity(0);
    expect(EnvironmentManager.getState().fog.density).toBe(0.001);
    EnvironmentManager.setFogDensity(5);
    expect(EnvironmentManager.getState().fog.density).toBe(1);
  });

  it("updateFog merges partial fog state", () => {
    EnvironmentManager.updateFog({ enabled: true, color: "#abcabc" });
    const fog = EnvironmentManager.getState().fog;
    expect(fog.enabled).toBe(true);
    expect(fog.color).toBe("#abcabc");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   GROUND PLANE
   ═══════════════════════════════════════════════════════════════════════ */

describe("EnvironmentManager — ground plane", () => {
  it("setGroundPlane toggles ground", () => {
    EnvironmentManager.setGroundPlane(true);
    expect(EnvironmentManager.getState().groundPlane).toBe(true);
    EnvironmentManager.setGroundPlane(false);
    expect(EnvironmentManager.getState().groundPlane).toBe(false);
  });

  it("setGroundColor changes color", () => {
    EnvironmentManager.setGroundColor("#aabbcc");
    expect(EnvironmentManager.getState().groundColor).toBe("#aabbcc");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SCENE APPLICATION
   ═══════════════════════════════════════════════════════════════════════ */

describe("EnvironmentManager — applyToScene", () => {
  it("sets background color on scene", () => {
    const scene = { background: null, fog: null, userData: {} };
    EnvironmentManager.applyToScene(scene);
    expect(scene.background).toBeDefined();
    expect(scene.background._c).toBe("#1a1a2e"); // studio default
  });

  it("sets linear fog when enabled", () => {
    EnvironmentManager.setFogEnabled(true);
    EnvironmentManager.setFogType("linear");
    const scene = { background: null, fog: null, userData: {} };
    EnvironmentManager.applyToScene(scene);
    expect(scene.fog).toBeDefined();
    expect(scene.fog.isFog).toBe(true);
  });

  it("sets exponential fog when enabled", () => {
    EnvironmentManager.setFogEnabled(true);
    EnvironmentManager.setFogType("exponential");
    const scene = { background: null, fog: null, userData: {} };
    EnvironmentManager.applyToScene(scene);
    expect(scene.fog).toBeDefined();
    expect(scene.fog.isFogExp2).toBe(true);
  });

  it("clears fog when disabled", () => {
    EnvironmentManager.setFogEnabled(false);
    const scene = { background: null, fog: { existing: true }, userData: {} };
    EnvironmentManager.applyToScene(scene);
    expect(scene.fog).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   CREATE FOG
   ═══════════════════════════════════════════════════════════════════════ */

describe("EnvironmentManager — createFog", () => {
  it("returns null when fog disabled", () => {
    expect(EnvironmentManager.createFog()).toBeNull();
  });

  it("returns Fog when enabled with linear type", () => {
    EnvironmentManager.setFogEnabled(true);
    EnvironmentManager.setFogType("linear");
    const fog = EnvironmentManager.createFog();
    expect(fog).toBeDefined();
    expect(fog.isFog).toBe(true);
  });

  it("returns FogExp2 when enabled with exponential type", () => {
    EnvironmentManager.setFogEnabled(true);
    EnvironmentManager.setFogType("exponential");
    const fog = EnvironmentManager.createFog();
    expect(fog).toBeDefined();
    expect(fog.isFogExp2).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   CREATE GROUND PLANE
   ═══════════════════════════════════════════════════════════════════════ */

describe("EnvironmentManager — createGroundPlane", () => {
  it("creates a mesh with __helper userData", () => {
    const mesh = EnvironmentManager.createGroundPlane(100);
    expect(mesh.name).toBe("__groundPlane");
    expect(mesh.userData.__helper).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
    expect(mesh.rotation.x).toBeCloseTo(-Math.PI / 2);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SUBSCRIBE
   ═══════════════════════════════════════════════════════════════════════ */

describe("EnvironmentManager — subscribe", () => {
  it("notifies listeners on state change", () => {
    const cb = vi.fn();
    const unsub = EnvironmentManager.subscribe(cb);
    EnvironmentManager.setBackgroundColor("#abc");
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].backgroundColor).toBe("#abc");
    unsub();
  });

  it("does not notify after unsubscribe", () => {
    const cb = vi.fn();
    const unsub = EnvironmentManager.subscribe(cb);
    unsub();
    EnvironmentManager.setBackgroundColor("#fff");
    expect(cb).not.toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   RESET
   ═══════════════════════════════════════════════════════════════════════ */

describe("EnvironmentManager — resetAll", () => {
  it("restores default state", () => {
    EnvironmentManager.applyPreset("night");
    EnvironmentManager.setFogEnabled(true);
    EnvironmentManager.setBackgroundColor("#ff00ff");
    EnvironmentManager.resetAll();
    const st = EnvironmentManager.getState();
    expect(st.preset).toBe("studio");
    expect(st.backgroundColor).toBe("#1a1a2e");
    expect(st.fog.enabled).toBe(false);
  });
});
