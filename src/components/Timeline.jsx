// src/components/Timeline.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import EventBus from '../utils/EventBus';
import '../styles/Timeline.css';

/**
 * Sort parallel times + values arrays in ascending time order.
 * `size` is the number of value components per keyframe (3 for vec3, 4 for quat).
 */
function sortKeyframes(times, values, size) {
  const indices = times.map((_, i) => i);
  indices.sort((a, b) => times[a] - times[b]);
  const sortedT = indices.map(i => times[i]);
  const sortedV = [];
  for (const i of indices) {
    for (let c = 0; c < size; c++) sortedV.push(values[i * size + c]);
  }
  return { times: sortedT, values: sortedV };
}

export default function Timeline({ workspaceRef, selected }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [length, setLength] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tracks, setTracks] = useState([]);
  const rafRef = useRef(null);

  // Sync animation state via rAF during playback, EventBus otherwise
  useEffect(() => {
    let mounted = true;

    const syncFromApi = () => {
      const api = workspaceRef.current?.getAnimationApi?.();
      if (!api || !mounted) return;
      try {
        const list = api.listTracks();
        setTracks(Array.isArray(list) ? list : []);
        setPlaying(!!api.playing);
        const t = api.time;
        const l = api.length;
        setCurrentTime(Number.isFinite(t) ? t : 0);
        setLength(Number.isFinite(l) ? l : 0);
      } catch (e) { /* transient */ }
    };

    // rAF loop for smooth time updates during playback
    const tick = () => {
      if (!mounted) return;
      syncFromApi();
      rafRef.current = requestAnimationFrame(tick);
    };

    syncFromApi();
    rafRef.current = requestAnimationFrame(tick);

    const onSceneUpdated = () => syncFromApi();
    EventBus.on?.('scene:updated', onSceneUpdated);

    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      EventBus.off?.('scene:updated', onSceneUpdated);
    };
  }, [workspaceRef]);

  const addKeyframe = useCallback((type) => {
    const api = workspaceRef.current?.getAnimationApi?.();
    if (!api || !selected) return;
    const prop = type === 'pos' ? 'position' : type === 'rot' ? 'quaternion' : 'scale';
    const size = prop === 'quaternion' ? 4 : 3;
    const existing = api.listTracks().find(t => t.uuid === selected.uuid && t.property === prop);
    const times = existing ? existing.times.slice() : [];
    const values = existing ? existing.values.slice() : [];
    const safeTime = Number.isFinite(currentTime) ? currentTime : 0;
    const now = parseFloat(safeTime.toFixed(2));
    if (!times.includes(now)) {
      times.push(now);
      if (prop === 'position') values.push(selected.position.x, selected.position.y, selected.position.z);
      else if (prop === 'quaternion') values.push(selected.quaternion.x, selected.quaternion.y, selected.quaternion.z, selected.quaternion.w);
      else values.push(selected.scale.x, selected.scale.y, selected.scale.z);
    }
    // Sort keyframes in ascending time order (required by Three.js KeyframeTrack)
    const sorted = sortKeyframes(times, values, size);
    if (existing) api.removeTrack(existing.id);
    api.addTrack({ uuid: selected.uuid, property: prop, times: sorted.times, values: sorted.values, size });
  }, [workspaceRef, selected, currentTime]);

  const playPause = useCallback(() => {
    const api = workspaceRef.current?.getAnimationApi?.();
    if (!api) return;
    if (api.playing) api.pause(); else api.play();
  }, [workspaceRef]);

  const seek = useCallback((e) => {
    const api = workspaceRef.current?.getAnimationApi?.();
    if (!api) return;
    let v = parseFloat(e.target.value);
    if (!Number.isFinite(v)) v = 0;
    api.seek(v);
    setCurrentTime(v);
  }, [workspaceRef]);

  const safeLen = Number.isFinite(length) ? length : 0;
  const safeCur = Number.isFinite(currentTime) ? currentTime : 0;

  return (
    <div className="timeline-panel">
      <div className="timeline-controls">
        <button onClick={playPause} className="studio-btn timeline-play-btn">{playing ? 'Pause' : 'Play'}</button>
        <div className="timeline-kf-group">
          <button onClick={() => addKeyframe('pos')} disabled={!selected} className="studio-btn">KF Pos</button>
          <button onClick={() => addKeyframe('rot')} disabled={!selected} className="studio-btn">KF Rot</button>
          <button onClick={() => addKeyframe('scale')} disabled={!selected} className="studio-btn">KF Scale</button>
        </div>
        <input className="timeline-scrubber" type="range" min={0} max={Math.max(1, safeLen)} step={0.01} value={safeCur} onChange={seek} />
        <div className="timeline-time-display">{safeCur.toFixed(2)} / {safeLen.toFixed(2)}s</div>
        <div className="timeline-track-chips">
          {tracks.slice(0, 6).map(t => <div key={t.id} className="timeline-track-chip">{t.property}:{t.times.length}</div>)}
        </div>
      </div>
    </div>
  );
}

Timeline.propTypes = {
  workspaceRef: PropTypes.any,
  selected: PropTypes.any,
};
