import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Palette from './Palette';
import useScrollRail from '../utils/useScrollRail';

// Collapsible palette panel that preserves a minimal collapsed rail (unique UI, not like other editors)
export default function PalettePanel({ paletteCollapsed, paletteWidth, onAddItem, onToggleCollapse, onResizeStart }) {
  const storedCollapsedKey = 'objekta_palette_collapsed_v1';
  const firstRef = useRef(true);
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      // initial persistence load handled by parent; keep here for future extension
      return;
    }
    try { localStorage.setItem(storedCollapsedKey, paletteCollapsed ? '1' : '0'); } catch (e) {}
  }, [paletteCollapsed]);

  const effectiveWidth = paletteCollapsed ? 46 : paletteWidth; // collapsed rail width

  const innerRef = useScrollRail();

  return (
    <div
      className={`studio-panel palette-panel reveal ${paletteCollapsed ? 'palette-collapsed' : ''}`}
      style={{ width: effectiveWidth, minWidth: paletteCollapsed ? 46 : 120, position: 'relative' }}
    >
      <div ref={innerRef} className="palette-inner" aria-hidden={paletteCollapsed}>
        <Palette items={[]} onAction={(name, client) => onAddItem?.(name, client)} />
        {!paletteCollapsed && <div className="palette-resizer" onMouseDown={onResizeStart} />}
      </div>

      <div className={`palette-rail ${paletteCollapsed ? 'is-visible' : ''}`} aria-hidden={!paletteCollapsed}>
        {['Cube', 'Sphere', 'Cone', 'Plane'].map((n) => (
          <button
            key={n}
            title={`Add ${n}`}
            className="studio-btn icon-btn ghost"
            style={{ width: 32, height: 32, fontSize: 14 }}
            onClick={() => onAddItem?.(n, null)}
          >
            {n[0]}
          </button>
        ))}
      </div>

      <button
        title={paletteCollapsed ? 'Open Palette (P)' : 'Collapse Palette (P)'}
        onClick={onToggleCollapse}
        className="studio-btn icon-btn collapse-toggle-btn"
        aria-pressed={paletteCollapsed}
        aria-label={paletteCollapsed ? 'Open palette panel (P)' : 'Collapse palette panel (P)'}
      >
        {paletteCollapsed ? '»' : '«'}
      </button>
    </div>
  );
}

PalettePanel.propTypes = {
  paletteCollapsed: PropTypes.bool,
  paletteWidth: PropTypes.number,
  onAddItem: PropTypes.func,
  onToggleCollapse: PropTypes.func,
  onResizeStart: PropTypes.func,
};
