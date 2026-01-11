// src/components/Timeline.jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

export default function Timeline({ workspaceRef, selected }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [length, setLength] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tracks, setTracks] = useState([]);

  useEffect(() => {
    const id = setInterval(() => {
      const api = workspaceRef.current?.getAnimationApi?.();
      if (!api) return;
      try {
        const list = api.listTracks();
        setTracks(Array.isArray(list) ? list : []);
        setPlaying(!!api.playing);
        const t = api.time;
        const l = api.length;
        setCurrentTime(Number.isFinite(t) ? t : 0);
        setLength(Number.isFinite(l) ? l : 0);
      } catch (e) {
        // Ignore transient API errors
      }
    }, 250);
    return () => clearInterval(id);
  }, [workspaceRef]);

  const addKeyframe = (type) => {
    const api = workspaceRef.current?.getAnimationApi?.();
    if (!api || !selected) return;
    // find existing track for property
    const prop = type === 'pos' ? 'position' : type === 'rot' ? 'quaternion' : 'scale';
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
    const size = prop === 'quaternion' ? 4 : 3;
    if (existing) {
      api.removeTrack(existing.id);
    }
    api.addTrack({ uuid: selected.uuid, property: prop, times, values, size });
  };

  const playPause = () => {
    const api = workspaceRef.current?.getAnimationApi?.();
    if (!api) return;
    if (api.playing) api.pause(); else api.play();
  };

  const seek = (e) => {
    const api = workspaceRef.current?.getAnimationApi?.();
    if (!api) return;
    let v = parseFloat(e.target.value);
    if (!Number.isFinite(v)) v = 0;
    api.seek(v);
    setCurrentTime(v);
  };

  return (
    <div className="timeline-panel" style={{ position:'absolute', left:0, right:0, bottom:0, background:'rgba(12,12,20,0.85)', backdropFilter:'blur(6px)', padding:'6px 10px', fontSize:12, zIndex:60, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <button onClick={playPause} className="studio-btn" style={{ minWidth:60 }}>{playing ? 'Pause' : 'Play'}</button>
        <div style={{ display:'flex', gap:4 }}>
          <button onClick={()=>addKeyframe('pos')} disabled={!selected} className="studio-btn">KF Pos</button>
          <button onClick={()=>addKeyframe('rot')} disabled={!selected} className="studio-btn">KF Rot</button>
          <button onClick={()=>addKeyframe('scale')} disabled={!selected} className="studio-btn">KF Scale</button>
        </div>
        {(() => {
          const safeLen = Number.isFinite(length) ? length : 0;
          const safeCur = Number.isFinite(currentTime) ? currentTime : 0;
          return (
            <>
              <input type="range" min={0} max={Math.max(1, safeLen)} step={0.01} value={safeCur} onChange={seek} style={{ flex:1 }} />
              <div style={{ width:90, textAlign:'right' }}>{safeCur.toFixed(2)} / {safeLen.toFixed(2)}s</div>
            </>
          );
        })()}
        <div style={{ display:'flex', gap:4 }}>
          {tracks.slice(0,4).map(t => <div key={t.id} style={{ padding:'2px 6px', background:'rgba(80,120,255,0.15)', borderRadius:4 }}>{t.property}:{t.times.length}</div>)}
        </div>
      </div>
    </div>
  );
}

Timeline.propTypes = {
  workspaceRef: PropTypes.any,
  selected: PropTypes.any,
};
