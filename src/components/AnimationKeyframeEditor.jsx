import React, { useEffect, useState, useRef } from 'react';

// AnimationKeyframeEditor: unique minimal keyframe UI for position/rotation/scale and scalar tracks.
// Integrates with window.__OBJEKTA_WORKSPACE AnimationEngine.
export default function AnimationKeyframeEditor() {
  const [engine, setEngine] = useState(null);
  const [selectedObj, setSelectedObj] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [property, setProperty] = useState('position');
  const [time, setTime] = useState(0);
  const [pendingKeys, setPendingKeys] = useState([]);
  const [size, setSize] = useState(3); // default vector3
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
    engine.addTrack({ uuid: selectedObj.uuid, property, times, values, size });
    setPendingKeys([]);
    refreshRef.current && refreshRef.current();
  };

  const clearPending = () => { setPendingKeys([]); };
  const removePendingKey = (index) => {
    setPendingKeys((prev) => prev.filter((_, i) => i !== index));
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

  return (
    <div style={{ position: 'absolute', right: 12, bottom: 14, width: 300, background: 'rgba(20,16,34,0.75)', backdropFilter: 'blur(6px)', color: '#eee', fontSize: 12, borderRadius: 10, padding: '10px 12px', zIndex: 95 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Keyframe Editor</div>
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
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <button className='studio-btn' onClick={commitTrack} disabled={pendingKeys.length === 0}>Commit Track</button>
            <button className='studio-btn' onClick={clearPending} disabled={pendingKeys.length === 0}>Clear</button>
          </div>
          <div style={{ maxHeight: 90, overflowY: 'auto', fontSize: 11, marginBottom: 6 }}>
            {pendingKeys.length === 0 && <div style={{ opacity: 0.5 }}>No pending keyframes</div>}
            {pendingKeys.map((k, i)=>(
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                <input
                  type='number'
                  step='0.01'
                  value={Number.isFinite(k.time) ? k.time : 0}
                  onChange={(e) => updatePendingTime(i, e.target.value)}
                  style={{ width: '100%' }}
                  aria-label={`Pending keyframe ${i + 1} time`}
                />
                <span title={k.value.join(', ')} style={{ opacity: 0.7 }}>v{i + 1}</span>
                <button className='studio-btn' style={{ padding: '1px 6px' }} onClick={() => removePendingKey(i)} aria-label={`Remove pending keyframe ${i + 1}`}>×</button>
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ fontWeight: 600, margin: '4px 0 4px' }}>Tracks</div>
      <div style={{ maxHeight: 100, overflowY: 'auto', fontSize: 11 }}>
        {tracks.length === 0 && <div style={{ opacity: 0.5 }}>No tracks</div>}
        {tracks.map(t => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>{t.property} ({t.uuid.slice(0,6)})</span>
            <button className='studio-btn' style={{ padding: '2px 6px' }} onClick={()=>removeTrack(t.id)}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}