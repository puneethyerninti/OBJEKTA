import React, { useEffect, useState, useRef, useCallback } from 'react';
import { EASING_NAMES, resolveEasing } from '../engine/AnimationEngine';
import EventBus from '../utils/EventBus';

// Mini canvas-based bezier curve preview
function EasingPreview({ easing, width = 80, height = 50 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const fn = resolveEasing(easing);
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(127,90,240,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height); ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.strokeStyle = '#7f5af0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = 0; px <= width; px++) {
      const t = px / width;
      const y = height - fn(t) * height;
      px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
    }
    ctx.stroke();
  }, [easing, width, height]);
  return <canvas ref={canvasRef} width={width} height={height} style={{ borderRadius: 4, background: 'rgba(0,0,0,0.3)', display: 'block' }} />;
}

export default function AnimationKeyframeEditor() {
  const [engine, setEngine] = useState(null);
  const [selectedObj, setSelectedObj] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [property, setProperty] = useState('position');
  const [easing, setEasing] = useState('linear');
  const [time, setTime] = useState(0);
  const [pendingKeys, setPendingKeys] = useState([]);
  const [size, setSize] = useState(3);
  const [selectedPending, setSelectedPending] = useState(new Set());
  const [copiedTrack, setCopiedTrack] = useState(null);
  const [autoKeyframe, setAutoKeyframe] = useState(false);
  const refreshRef = useRef(null);

  useEffect(() => {
    const ws = window.__OBJEKTA_WORKSPACE;
    if (!ws?.getAnimationEngine) return;
    const eng = ws.getAnimationEngine();
    setEngine(eng);
    const refresh = () => {
      try { setTracks(eng.listTracks()); } catch (e) {}
      try { setSelectedObj(ws.getSelected?.() || null); } catch (e) {}
    };
    refresh();
    refreshRef.current = refresh;
    const iv = setInterval(refresh, 800);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (/quaternion/i.test(property)) setSize(4); else if (/position|scale/i.test(property)) setSize(3); else setSize(1);
  }, [property]);

  // Auto-keyframe: listen to transform commits
  useEffect(() => {
    if (!autoKeyframe || !engine) return;
    const onCommit = () => {
      const ws = window.__OBJEKTA_WORKSPACE;
      const obj = ws?.getSelected?.();
      if (!obj) return;
      const eng = ws.getAnimationEngine?.();
      if (!eng) return;
      const t = eng.time || 0;
      // Auto-add position, quaternion, and scale keyframes
      ['position', 'scale', 'quaternion'].forEach((prop) => {
        let values;
        if (prop === 'position') values = [obj.position.x, obj.position.y, obj.position.z];
        else if (prop === 'scale') values = [obj.scale.x, obj.scale.y, obj.scale.z];
        else values = [obj.quaternion.x, obj.quaternion.y, obj.quaternion.z, obj.quaternion.w];
        const sz = prop === 'quaternion' ? 4 : 3;
        // Find existing track for this object+property or create new one
        const existingTracks = eng.listTracks().filter((tr) => tr.uuid === obj.uuid && tr.property === prop);
        if (existingTracks.length > 0) {
          // Add keyframe to existing track by re-adding with merged times
          const track = existingTracks[0];
          const newTimes = [...track.times, t];
          const newValues = [...track.values, ...values];
          eng.removeTrack(track.id);
          eng.addTrack({ uuid: obj.uuid, property: prop, times: newTimes, values: newValues, size: sz, easing: track.easing });
        } else {
          eng.addTrack({ uuid: obj.uuid, property: prop, times: [t], values, size: sz, easing: 'linear' });
        }
      });
      refreshRef.current?.();
    };
    EventBus.on('transform:commit', onCommit);
    return () => EventBus.off('transform:commit', onCommit);
  }, [autoKeyframe, engine]);

  if (!engine) return null;

  const sampleCurrentValue = () => {
    if (!selectedObj) return [0];
    if (property === 'position') return [selectedObj.position.x, selectedObj.position.y, selectedObj.position.z];
    if (property === 'scale') return [selectedObj.scale.x, selectedObj.scale.y, selectedObj.scale.z];
    if (property === 'quaternion') return [selectedObj.quaternion.x, selectedObj.quaternion.y, selectedObj.quaternion.z, selectedObj.quaternion.w];
    return [Number(selectedObj[property]) || 0];
  };

  const normalizePending = (items = []) => {
    const sorted = [...items].sort((a, b) => a.time - b.time);
    const dedup = [];
    sorted.forEach((item) => {
      if (dedup.length && Math.abs(dedup[dedup.length - 1].time - item.time) < 1e-4) {
        dedup[dedup.length - 1] = item;
      } else {
        dedup.push(item);
      }
    });
    return dedup;
  };

  const addKeyframe = () => {
    if (!selectedObj) return;
    const nextTime = Number(time);
    if (!Number.isFinite(nextTime)) return;
    const value = sampleCurrentValue();
    setPendingKeys((prev) => normalizePending([...prev, { time: nextTime, value }]));
  };

  const commitTrack = () => {
    if (!selectedObj || pendingKeys.length === 0) return;
    const ordered = normalizePending(pendingKeys);
    const times = ordered.map((k) => k.time);
    const values = ordered.flatMap((k) => k.value);
    engine.addTrack({ uuid: selectedObj.uuid, property, times, values, size, easing });
    setPendingKeys([]);
    setSelectedPending(new Set());
    refreshRef.current && refreshRef.current();
  };

  const clearPending = () => { setPendingKeys([]); setSelectedPending(new Set()); };
  const removePendingKey = (index) => {
    setPendingKeys((prev) => prev.filter((_, i) => i !== index));
    setSelectedPending((prev) => { const next = new Set(prev); next.delete(index); return next; });
  };
  const updatePendingTime = (index, nextTime) => {
    const numeric = Number(nextTime);
    if (!Number.isFinite(numeric)) return;
    setPendingKeys((prev) => {
      const next = prev.map((k, i) => (i === index ? { ...k, time: numeric } : k));
      return normalizePending(next);
    });
  };
  const removeTrack = (id) => { engine.removeTrack(id); refreshRef.current && refreshRef.current(); };

  const togglePendingSelection = (index) => {
    setSelectedPending((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const batchDeleteSelected = () => {
    if (selectedPending.size === 0) return;
    setPendingKeys((prev) => prev.filter((_, i) => !selectedPending.has(i)));
    setSelectedPending(new Set());
  };

  const copyTrackHandler = (id) => {
    const copied = engine.copyTrack(id);
    if (copied) setCopiedTrack(copied);
  };

  const pasteTrackHandler = () => {
    if (!copiedTrack || !selectedObj) return;
    engine.pasteTrack(copiedTrack, selectedObj.uuid);
    refreshRef.current?.();
  };

  return (
    <div style={{ position: 'absolute', right: 12, bottom: 14, width: 300, background: 'rgba(20,16,34,0.75)', backdropFilter: 'blur(6px)', color: '#eee', fontSize: 12, borderRadius: 10, padding: '10px 12px', zIndex: 95 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontWeight: 600 }}>Keyframe Editor</div>
        <label style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="checkbox" checked={autoKeyframe} onChange={(e) => setAutoKeyframe(e.target.checked)} />
          Auto-KF
        </label>
      </div>
      {!selectedObj && <div style={{ opacity: 0.6 }}>Select an object to keyframe.</div>}
      {selectedObj && (
        <>
          <div style={{ marginBottom: 6, display: 'flex', gap: 6 }}>
            <select value={property} onChange={(e)=>setProperty(e.target.value)} style={{ flex: 1 }}>
              <option value='position'>position</option>
              <option value='scale'>scale</option>
              <option value='quaternion'>quaternion</option>
              <option value='opacity'>opacity</option>
              <option value='intensity'>intensity</option>
            </select>
            <input type='number' step='0.01' value={time} onChange={(e)=>setTime(e.target.value)} style={{ width: 70 }} />
            <button className='studio-btn' onClick={addKeyframe}>Add</button>
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
            <select value={easing} onChange={(e)=>setEasing(e.target.value)} style={{ flex: 1 }}>
              {EASING_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <EasingPreview easing={easing} width={80} height={40} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <button className='studio-btn' onClick={commitTrack} disabled={pendingKeys.length === 0}>Commit Track</button>
            <button className='studio-btn' onClick={clearPending} disabled={pendingKeys.length === 0}>Clear</button>
            {selectedPending.size > 0 && (
              <button className='studio-btn' onClick={batchDeleteSelected} style={{ background: '#e53e3e', color: '#fff' }}>
                Delete ({selectedPending.size})
              </button>
            )}
          </div>
          <div style={{ maxHeight: 90, overflowY: 'auto', fontSize: 11, marginBottom: 6 }}>
            {pendingKeys.length === 0 && <div style={{ opacity: 0.5 }}>No pending keyframes</div>}
            {pendingKeys.map((k, i)=>(
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                <input
                  type='checkbox'
                  checked={selectedPending.has(i)}
                  onChange={() => togglePendingSelection(i)}
                  aria-label={`Select keyframe ${i + 1}`}
                />
                <input
                  type='number'
                  step='0.01'
                  value={Number.isFinite(k.time) ? k.time : 0}
                  onChange={(e) => updatePendingTime(i, e.target.value)}
                  style={{ width: '100%' }}
                  aria-label={`Pending keyframe ${i + 1} time`}
                />
                <span title={k.value.join(', ')} style={{ opacity: 0.7 }}>v{i + 1}</span>
                <button className='studio-btn' style={{ padding: '1px 6px' }} onClick={() => removePendingKey(i)} aria-label={`Remove pending keyframe ${i + 1}`}>x</button>
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 4px' }}>
        <div style={{ fontWeight: 600 }}>Tracks</div>
        {copiedTrack && selectedObj && (
          <button className='studio-btn' onClick={pasteTrackHandler} style={{ fontSize: 10, padding: '2px 6px' }}>
            Paste Track
          </button>
        )}
      </div>
      <div style={{ maxHeight: 100, overflowY: 'auto', fontSize: 11 }}>
        {tracks.length === 0 && <div style={{ opacity: 0.5 }}>No tracks</div>}
        {tracks.map(t => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{t.property} ({t.uuid.slice(0,6)})</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className='studio-btn' style={{ padding: '2px 6px', fontSize: 10 }} onClick={()=>copyTrackHandler(t.id)} title="Copy track">Cp</button>
              <button className='studio-btn' style={{ padding: '2px 6px' }} onClick={()=>removeTrack(t.id)}>x</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
