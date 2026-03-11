import React, { useEffect, useState } from 'react';

// Animation scrubber UI with loop mode and speed controls
// Tied to window.__OBJEKTA_WORKSPACE AnimationEngine
export default function AnimationScrubber() {
  const [engine, setEngine] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loopMode, setLoopMode] = useState('loop');
  const [speed, setSpeed] = useState(1);
  const [markers, setMarkers] = useState([]);

  useEffect(() => {
    const ws = window.__OBJEKTA_WORKSPACE;
    if (ws?.getAnimationEngine) {
      const eng = ws.getAnimationEngine();
      setEngine(eng);
      setLoopMode(eng.loopMode || 'loop');
      setSpeed(eng.playbackRate || 1);
      const refresh = () => {
        try { setTracks(eng.listTracks()); setLength(eng.length); setPlaying(eng.playing); } catch (e) {}
      };
      refresh();
      const iv = setInterval(() => {
        if (!eng) return;
        setTime(eng.time);
        setLength(eng.length);
        setPlaying(eng.playing);
        try { setMarkers(eng.listMarkers()); } catch (e) {}
      }, 200);
      return () => clearInterval(iv);
    }
  }, []);

  if (!engine) return null;

  const onPlayPause = () => { playing ? engine.pause() : engine.play(); setPlaying(!playing); };
  const onSeek = (e) => { const v = parseFloat(e.target.value); engine.seek(v); setTime(v); };
  const onLoopModeChange = (e) => { const m = e.target.value; engine.setLoopMode(m); setLoopMode(m); };
  const onSpeedChange = (e) => { const s = parseFloat(e.target.value); engine.setPlaybackRate(s); setSpeed(s); };
  const onStop = () => { engine.pause(); engine.seek(0); setPlaying(false); setTime(0); };
  const onAddMarker = () => {
    const name = prompt('Marker name:', `Marker ${markers.length + 1}`);
    if (name) { engine.addMarker(time, name); setMarkers(engine.listMarkers()); }
  };
  const onRemoveMarker = (t) => { engine.removeMarker(t); setMarkers(engine.listMarkers()); };
  const onJumpToMarker = (t) => { engine.seek(t); setTime(t); };

  return (
    <div style={{ position: 'absolute', left: 12, bottom: 54, width: 320, background: 'rgba(0,0,0,0.55)', color: '#eee', fontSize: 12, borderRadius: 8, padding: '8px 10px', zIndex: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <button onClick={onPlayPause} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', padding: '4px 10px', color: '#eee', cursor: 'pointer', borderRadius: 4 }}>
          {playing ? '⏸' : '▶'}
        </button>
        <button onClick={onStop} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', padding: '4px 8px', color: '#eee', cursor: 'pointer', borderRadius: 4 }} title="Stop">
          ⏹
        </button>
        <input type="range" min={0} max={Math.max(length, 0.001)} step={0.01} value={time} onChange={onSeek} style={{ flex: 1 }} />
        <div style={{ minWidth: 50, textAlign: 'right' }}>{time.toFixed(2)}s</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <select value={loopMode} onChange={onLoopModeChange} style={{ fontSize: 11, padding: '2px 4px' }}>
          <option value="loop">Loop</option>
          <option value="pingpong">Ping-Pong</option>
          <option value="once">Once</option>
        </select>
        <label style={{ fontSize: 11, opacity: 0.7, whiteSpace: 'nowrap' }}>Speed</label>
        <select value={speed} onChange={onSpeedChange} style={{ fontSize: 11, padding: '2px 4px' }}>
          {[0.25, 0.5, 1, 1.5, 2, 4].map((s) => (
            <option key={s} value={s}>{s}×</option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, opacity: 0.5 }}>{tracks.length} tracks · {length.toFixed(2)}s</span>
      </div>
      {/* Markers row */}
      {(markers.length > 0 || tracks.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
          <button onClick={onAddMarker} style={{ fontSize: 10, background: 'rgba(255,255,255,0.08)', border: 'none', color: '#eee', cursor: 'pointer', borderRadius: 3, padding: '2px 6px' }} title="Add marker at current time">+ Marker</button>
          {markers.map(m => (
            <span key={m.time} style={{ fontSize: 10, background: m.color || '#ff0', color: '#000', borderRadius: 3, padding: '1px 5px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 }}
              onClick={() => onJumpToMarker(m.time)} title={`Jump to ${m.time.toFixed(2)}s`}>
              {m.name}
              <span onClick={(e) => { e.stopPropagation(); onRemoveMarker(m.time); }} style={{ cursor: 'pointer', opacity: 0.6 }}>×</span>
            </span>
          ))}
        </div>
      )}
      <div style={{ maxHeight: 100, overflowY: 'auto', fontSize: 11 }}>
        {tracks.length === 0 && <div style={{ opacity: 0.6 }}>No tracks</div>}
        {tracks.map(t => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px', background: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 3 }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{t.property} <span style={{ opacity: 0.5 }}>({t.easing || 'linear'})</span></div>
            <div style={{ opacity: 0.7 }}>{((t.times[t.times.length-1])||0).toFixed(2)}s</div>
          </div>
        ))}
      </div>
    </div>
  );
}