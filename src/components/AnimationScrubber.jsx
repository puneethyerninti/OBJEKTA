import React, { useEffect, useState } from 'react';

// Simple animation scrubber UI tied to window.__OBJEKTA_WORKSPACE AnimationEngine
// Displays tracks and allows play/pause/seek.
export default function AnimationScrubber() {
  const [engine, setEngine] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const ws = window.__OBJEKTA_WORKSPACE;
    if (ws?.getAnimationEngine) {
      const eng = ws.getAnimationEngine();
      setEngine(eng);
      const refresh = () => {
        try { setTracks(eng.listTracks()); setLength(eng.length); setPlaying(eng.playing); } catch (e) {}
      };
      refresh();
      const iv = setInterval(() => {
        if (!eng) return;
        setTime(eng.time);
        setLength(eng.length);
        setPlaying(eng.playing);
      }, 200);
      return () => clearInterval(iv);
    }
  }, []);

  if (!engine) return null;

  const onPlayPause = () => { playing ? engine.pause() : engine.play(); setPlaying(!playing); };
  const onSeek = (e) => { const v = parseFloat(e.target.value); engine.seek(v); setTime(v); };

  return (
    <div style={{ position: 'absolute', left: 12, bottom: 54, width: 280, background: 'rgba(0,0,0,0.55)', color: '#eee', fontSize: 12, borderRadius: 8, padding: '8px 10px', zIndex: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <button onClick={onPlayPause} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', padding: '4px 10px', color: '#eee', cursor: 'pointer', borderRadius: 4 }}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <input type="range" min={0} max={Math.max(length, 0.001)} step={0.01} value={time} onChange={onSeek} style={{ flex: 1 }} />
        <div style={{ minWidth: 50, textAlign: 'right' }}>{time.toFixed(2)} / {length.toFixed(2)}</div>
      </div>
      <div style={{ maxHeight: 120, overflowY: 'auto', fontSize: 11 }}>
        {tracks.length === 0 && <div style={{ opacity: 0.6 }}>No tracks</div>}
        {tracks.map(t => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px', background: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 3 }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{t.property}</div>
            <div style={{ opacity: 0.7 }}>len {((t.times[t.times.length-1])||0).toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}