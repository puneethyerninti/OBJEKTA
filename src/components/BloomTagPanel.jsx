import React, { useEffect, useState } from 'react';

// BloomTagPanel: lets user manually tag selected object(s) for bloom highlighting.
export default function BloomTagPanel({ workspaceRef }) {
  const [selection, setSelection] = useState([]);
  const [enabledCount, setEnabledCount] = useState(0);

  useEffect(() => {
    const scan = () => {
      try {
        const ws = workspaceRef.current;
        if (!ws) return;
        const scene = ws.getScene?.() || ws.scene;
        const sel = ws.getSelectedObjects?.() ? ws.getSelectedObjects() : (ws.getSelected?.() ? [ws.getSelected()] : []);
        setSelection(sel.filter(Boolean));
        let count = 0;
        sel.forEach(o => { if (o?.userData?.__bloom) count++; });
        setEnabledCount(count);
      } catch (e) {}
    };
    scan();
    const iv = setInterval(scan, 500);
    return () => clearInterval(iv);
  }, [workspaceRef]);

  const toggleBloom = (obj) => {
    if (!obj) return;
    try {
      obj.userData.__bloom = !obj.userData.__bloom;
      if (obj.layers) {
        const BLOOM_LAYER = 11; // same as post-processing
        obj.userData.__bloom ? obj.layers.enable(BLOOM_LAYER) : obj.layers.disable(BLOOM_LAYER);
      }
      obj.traverse?.((c) => { if (c.isMesh) c.material && (c.material.needsUpdate = true); });
    } catch (e) {}
  };

  if (!selection.length) return null;

  return (
    <div style={{ position: 'absolute', right: 380, bottom: 14, background: 'rgba(25,18,40,0.72)', backdropFilter: 'blur(6px)', color: '#eee', fontSize: 12, padding: '10px 12px', borderRadius: 10, zIndex: 90, width: 240 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Bloom Tagging</div>
      <div style={{ maxHeight: 140, overflowY: 'auto' }}>
        {selection.map(o => (
          <div key={o.uuid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{o.name || o.type || o.uuid}</span>
            <button className='studio-btn' style={{ padding: '4px 10px' }} onClick={() => toggleBloom(o)}>
              {o.userData.__bloom ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 6, opacity: 0.7 }}>Tagged: {enabledCount}</div>
    </div>
  );
}