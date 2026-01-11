import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

// Cycles alphaTest values and captures canvas snapshots when
// window.__OBJEKTA_AUTO_ALPHA_TEST is truthy. Use with Scene-level state
// setter: <GridAlphaTester run={true} setAlpha={setAlpha} />
export default function GridAlphaTester({ run = false, setAlpha }) {
  const { gl } = useThree();

  useEffect(() => {
    if (!run || typeof setAlpha !== 'function' || !gl) return;
    const values = [0.01, 0.02, 0.03];
    let idx = 0;
    let active = true;

    async function captureCycle() {
      for (const v of values) {
        if (!active) break;
        // set alpha for TronGrid via Scene state
        setAlpha(v);
        // wait a short moment for frame to update
        await new Promise((r) => setTimeout(r, 400));
        try {
          const data = gl.domElement.toDataURL('image/png');
          // trigger a download for the snapshot
          const a = document.createElement('a');
          a.href = data;
          a.download = `tron-grid-alpha-${String(v).replace('.', '_')}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
        } catch (e) {
          // ignore snapshot errors
          // console.debug('[GridAlphaTester] snapshot failed', e);
        }
        idx++;
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    // Run one cycle and stop
    captureCycle();

    return () => {
      active = false;
    };
  }, [run, setAlpha, gl]);

  return null;
}
