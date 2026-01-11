// src/engine/AnimationEngine.js
// Phase 1 lightweight track-based animation controller
// Track format: { id, uuid, property, times: [Number], values: [Number], size: components per key (e.g.3 for position,4 for quaternion), interpolation: 'linear' }
// Supports position (vector3), quaternion (4), numeric scalar properties.

import * as THREE from 'three';

let _nextTrackId = 1;

export default class AnimationEngine {
  constructor() {
    this.tracks = new Map(); // id -> track
    this.playing = false;
    this.time = 0;
    this.length = 0; // max time across tracks
    this.loop = true;
    this.playbackRate = 1;
    this._lastUpdateTs = null;
  }

  addTrack(track) {
    if (!track || !Array.isArray(track.times) || !Array.isArray(track.values)) return null;
    const id = track.id || (_nextTrackId++);
    const size = track.size || this._inferSize(track.property, track.values);
    const sorted = this._sortAndDedup(track.times, track.values, size);
    const t = { id, uuid: track.uuid, property: track.property, times: sorted.times, values: sorted.values, size, interpolation: track.interpolation || 'linear' };
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
  setPlaybackRate(rate = 1) { this.playbackRate = Number.isFinite(rate) ? rate : 1; }
  clear() { this.tracks.clear(); this.time = 0; this.length = 0; }

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
      if (this.loop) this.time = this.time % this.length;
      else {
        this.time = this.length;
        this.pause();
      }
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

  _inferSize(prop, values) {
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
    const t0 = times[i]; const t1 = times[i+1]; const alpha = (time - t0)/(t1 - t0);
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
}
