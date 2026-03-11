// src/engine/AnimationEngine.js
// Track-based animation controller with easing, layers, and export support.
// Track format: { id, uuid, property, times: [Number], values: [Number], size: components per key (e.g.3 for position,4 for quaternion), interpolation: 'linear', easing: 'linear' }
// Supports position (vector3), quaternion (4), numeric scalar properties.

import * as THREE from 'three';

let _nextTrackId = 1;

/* ═══════════════════════════════════════════════════════════════════════════
   EASING FUNCTIONS
   ═══════════════════════════════════════════════════════════════════════ */

export const Easings = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => t * (2 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => (--t) * t * t + 1,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeInQuart: (t) => t * t * t * t,
  easeOutQuart: (t) => 1 - (--t) * t * t * t,
  easeInOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  easeInBack: (t) => { const c = 1.70158; return (c + 1) * t * t * t - c * t * t; },
  easeOutBack: (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  easeInOutBack: (t) => {
    const c = 1.70158 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c + 1) * (t * 2 - 2) + c) + 2) / 2;
  },
  easeInElastic: (t) => (t === 0 || t === 1) ? t : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3)),
  easeOutElastic: (t) => (t === 0 || t === 1) ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  easeOutBounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

/** Create a cubic bezier easing function from 4 control points */
export function cubicBezier(p1x, p1y, p2x, p2y) {
  // Newton-Raphson method to solve for t given x
  return function bezierEasing(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const cx = 3 * p1x * t * (1 - t) * (1 - t) + 3 * p2x * t * t * (1 - t) + t * t * t - x;
      const dx = 3 * p1x * (1 - t) * (1 - t) - 6 * p1x * t * (1 - t) + 6 * p2x * t * (1 - t) - 3 * p2x * t * t + 3 * t * t;
      if (Math.abs(dx) < 1e-6) break;
      t -= cx / dx;
      t = Math.max(0, Math.min(1, t));
    }
    return 3 * p1y * t * (1 - t) * (1 - t) + 3 * p2y * t * t * (1 - t) + t * t * t;
  };
}

/** Resolve easing by name or return function */
export function resolveEasing(easing) {
  if (typeof easing === 'function') return easing;
  if (typeof easing === 'string' && Easings[easing]) return Easings[easing];
  return Easings.linear;
}

export const EASING_NAMES = Object.keys(Easings);

export default class AnimationEngine {
  constructor() {
    this.tracks = new Map(); // id -> track
    this.playing = false;
    this.time = 0;
    this.length = 0; // max time across tracks
    this.loop = true;
    this.loopMode = 'loop'; // 'loop' | 'pingpong' | 'once'
    this.playbackRate = 1;
    this._lastUpdateTs = null;
    this._pingpongForward = true;
    this.markers = new Map(); // time -> { name, color }
  }

  addTrack(track) {
    if (!track || !Array.isArray(track.times) || !Array.isArray(track.values)) return null;
    const id = track.id || (_nextTrackId++);
    const size = track.size || this._inferSize(track.property, track.values);
    const sorted = this._sortAndDedup(track.times, track.values, size);
    const t = { id, uuid: track.uuid, property: track.property, times: sorted.times, values: sorted.values, size, interpolation: track.interpolation || 'linear', easing: track.easing || 'linear' };
    this.tracks.set(id, t);
    this._recalcLength();
    return id;
  }

  removeTrack(id) { this.tracks.delete(id); this._recalcLength(); }
  listTracks() { return Array.from(this.tracks.values()); }

  snapshot() { return this.listTracks().map((t) => ({ ...t, times: t.times.slice(), values: t.values.slice() })); }

  loadSnapshot(tracks = []) {
    this.tracks.clear();
    tracks.forEach((t) => this.addTrack(t));
    this.time = 0;
    this.playing = false;
    this._recalcLength();
  }

  play() { this.playing = true; }
  pause() { this.playing = false; }
  seek(t) { this.time = Math.max(0, t); }
  setLoop(loop) { this.loop = !!loop; }
  setLoopMode(mode = 'loop') { this.loopMode = mode; this.loop = mode !== 'once'; }
  setPlaybackRate(rate = 1) { this.playbackRate = Number.isFinite(rate) ? Math.max(0.1, Math.min(rate, 8)) : 1; }
  clear() { this.tracks.clear(); this.time = 0; this.length = 0; this.markers.clear(); }

  // Marker system
  addMarker(time, name, color = '#ffcc00') { this.markers.set(time, { name, color }); }
  removeMarker(time) { this.markers.delete(time); }
  listMarkers() { return Array.from(this.markers.entries()).map(([t, m]) => ({ time: t, ...m })).sort((a, b) => a.time - b.time); }

  update(tsOrDeltaSeconds = null) {
    if (!this.playing) { this._lastUpdateTs = tsOrDeltaSeconds ?? performance.now(); return false; }
    const now = tsOrDeltaSeconds ?? performance.now();
    const prevTs = this._lastUpdateTs ?? now;
    const delta = typeof tsOrDeltaSeconds === 'number' && tsOrDeltaSeconds < 1000 ? tsOrDeltaSeconds : (now - prevTs) * 0.001;
    this._lastUpdateTs = now;
    const dt = Math.max(0, delta) * (this.playbackRate || 1);
    if (dt === 0) return false;

    this.time += dt;
    if (this.length > 0 && this.time > this.length) {
      if (this.loopMode === 'pingpong') {
        this._pingpongForward = false;
        this.time = this.length - (this.time - this.length);
      } else if (this.loop) {
        this.time = this.time % this.length;
      } else {
        this.time = this.length;
        this.pause();
      }
    }
    if (this.loopMode === 'pingpong' && !this._pingpongForward) {
      this.time -= dt * 2; // reverse
      if (this.time <= 0) { this.time = Math.abs(this.time); this._pingpongForward = true; }
    }
    return this._applyAll();
  }

  _applyAll() {
    let changed = false;
    for (const track of this.tracks.values()) {
      const obj = this._findObject(track.uuid);
      if (!obj) continue;
      const value = this._sampleTrack(track, this.time);
      if (!value) continue;
      this._applyValue(obj, track.property, value);
      changed = true;
    }
    return changed;
  }

  _findObject(uuid) {
    // global workspace attempt
    try {
      const scene = window.__OBJEKTA_WORKSPACE?.getScene?.();
      return scene?.getObjectByProperty?.('uuid', uuid) || null;
    } catch (e) { return null; }
  }

  _inferSize(prop, _values) {
    if (/quaternion/i.test(prop)) return 4;
    if (/position|scale/i.test(prop)) return 3;
    return 1;
  }

  _sampleTrack(track, time) {
    const { times, values, size } = track;
    if (times.length === 0) return null;
    if (time <= times[0]) return values.slice(0, size);
    if (time >= times[times.length -1]) return values.slice((times.length -1)*size, (times.length)*size);
    // find interval
    let i = 0;
    while (i < times.length -1 && time > times[i+1]) i++;
    const t0 = times[i]; const t1 = times[i+1];
    const rawAlpha = (time - t0)/(t1 - t0);
    const easingFn = resolveEasing(track.easing);
    const alpha = easingFn(rawAlpha);
    if (size === 4 && /quaternion/i.test(track.property)) {
      const q0 = new THREE.Quaternion(values[i*size], values[i*size+1], values[i*size+2], values[i*size+3]);
      const q1 = new THREE.Quaternion(values[(i+1)*size], values[(i+1)*size+1], values[(i+1)*size+2], values[(i+1)*size+3]);
      const q = new THREE.Quaternion();
      THREE.Quaternion.slerp(q0, q1, q, alpha);
      return [q.x, q.y, q.z, q.w];
    }
    const out = new Array(size);
    for (let c=0;c<size;c++) {
      const v0 = values[i*size + c];
      const v1 = values[(i+1)*size + c];
      out[c] = v0 + (v1 - v0)*alpha;
    }
    return out;
  }

  _applyValue(obj, property, value) {
    try {
      if (/position/i.test(property) && obj.position && value.length >=3) {
        obj.position.set(value[0], value[1], value[2]);
      } else if (/quaternion/i.test(property) && obj.quaternion && value.length >=4) {
        obj.quaternion.set(value[0], value[1], value[2], value[3]);
      } else if (/scale/i.test(property) && obj.scale && value.length >=3) {
        obj.scale.set(value[0], value[1], value[2]);
      } else if (obj[property] !== undefined && value.length ===1) {
        obj[property] = value[0];
      }
      obj.updateMatrixWorld?.();
    } catch (e) {}
  }

  _recalcLength() {
    let maxT = 0;
    for (const t of this.tracks.values()) maxT = Math.max(maxT, t.times[t.times.length -1] || 0);
    this.length = maxT;
  }

  _sortAndDedup(times, values, size) {
    const pairs = times.map((t, idx) => ({ t: Number(t) || 0, v: values.slice(idx*size, idx*size + size) }));
    pairs.sort((a, b) => a.t - b.t);
    const dedup = [];
    for (const p of pairs) {
      if (dedup.length && Math.abs(dedup[dedup.length -1].t - p.t) < 1e-4) {
        dedup[dedup.length -1] = p; // replace duplicate time with latest value
      } else {
        dedup.push(p);
      }
    }
    const outTimes = dedup.map((p) => p.t);
    const outVals = dedup.flatMap((p) => p.v);
    return { times: outTimes, values: outVals };
  }

  /**
   * Bake all tracks into a THREE.AnimationClip for GLB export.
   * Tracks are grouped by uuid, each becoming a set of KeyframeTrack entries.
   * Easing is baked by sampling at the given fps.
   * @param {number} fps — sample rate for easing bake (default 30)
   * @returns {THREE.AnimationClip}
   */
  toAnimationClip(fps = 30) {
    const keyframeTracks = [];
    for (const track of this.tracks.values()) {
      const obj = this._findObject(track.uuid);
      if (!obj) continue;
      const objName = obj.name || obj.uuid;
      const propMap = {
        position: '.position',
        scale: '.scale',
        quaternion: '.quaternion',
      };
      const threeProp = propMap[track.property] || `.${track.property}`;
      const trackName = `${objName}${threeProp}`;

      const isNonLinear = track.easing && track.easing !== 'linear';

      if (isNonLinear && track.times.length >= 2) {
        // Bake easing by sampling at fps
        const startTime = track.times[0];
        const endTime = track.times[track.times.length - 1];
        const duration = endTime - startTime;
        const numSamples = Math.max(2, Math.ceil(duration * fps));
        const bakedTimes = [];
        const bakedValues = [];
        for (let s = 0; s <= numSamples; s++) {
          const t = startTime + (s / numSamples) * duration;
          bakedTimes.push(t);
          const val = this._sampleTrack(track, t);
          if (val) bakedValues.push(...val);
        }
        if (track.size === 4 && /quaternion/i.test(track.property)) {
          keyframeTracks.push(new THREE.QuaternionKeyframeTrack(trackName, bakedTimes, bakedValues));
        } else if (track.size >= 3) {
          keyframeTracks.push(new THREE.VectorKeyframeTrack(trackName, bakedTimes, bakedValues));
        } else {
          keyframeTracks.push(new THREE.NumberKeyframeTrack(trackName, bakedTimes, bakedValues));
        }
      } else {
        // Linear — use raw keyframes directly
        if (track.size === 4 && /quaternion/i.test(track.property)) {
          keyframeTracks.push(new THREE.QuaternionKeyframeTrack(trackName, track.times, track.values));
        } else if (track.size >= 3) {
          keyframeTracks.push(new THREE.VectorKeyframeTrack(trackName, track.times, track.values));
        } else {
          keyframeTracks.push(new THREE.NumberKeyframeTrack(trackName, track.times, track.values));
        }
      }
    }
    return new THREE.AnimationClip('ObjektaAnimation', this.length || -1, keyframeTracks);
  }
}
