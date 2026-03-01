import React from 'react';
import useScrollRail from '../utils/useScrollRail';
import PropTypes from 'prop-types';
import { FiMaximize, FiMinimize, FiSidebar, FiLayers } from 'react-icons/fi';

export default function StudioToolbar({
  onUndo, onRedo, onSave, onExport, onToggleFull, isFull,
  activeMode, setActiveMode, snapEnabled, setSnapEnabled, togglePalette, toggleProps,
  paletteCollapsed, propsCollapsed
}) {
  const toolbarRef = useScrollRail();

  return (
    <div ref={toolbarRef} className="studio-toolbar reveal" role="toolbar" aria-label="Studio toolbar">
      <button className="studio-btn icon-btn" onClick={onUndo} aria-label="Undo">⤺</button>
      <button className="studio-btn icon-btn" onClick={onRedo} aria-label="Redo">⤻</button>

      <div className="segmented-control" role="group" aria-label="Transform modes">
        <button className={activeMode === 'translate' ? 'active' : ''} onClick={() => setActiveMode('translate')}>Move</button>
        <button className={activeMode === 'rotate' ? 'active' : ''} onClick={() => setActiveMode('rotate')}>Rotate</button>
        <button className={activeMode === 'scale' ? 'active' : ''} onClick={() => setActiveMode('scale')}>Scale</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
        <button className="studio-btn" onClick={() => setSnapEnabled(!snapEnabled)} aria-pressed={snapEnabled}>{snapEnabled ? 'Snap On' : 'Snap Off'}</button>
        <button className="studio-btn" onClick={onSave} aria-label="Save">Save</button>
        <button className="studio-btn" onClick={onExport} aria-label="Export">Export</button>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <button className="studio-btn icon-btn" onClick={togglePalette} aria-pressed={!paletteCollapsed} aria-label="Toggle palette"><FiSidebar /></button>
        <button className="studio-btn icon-btn" onClick={toggleProps} aria-pressed={!propsCollapsed} aria-label="Toggle inspector"><FiLayers /></button>
        <button className="studio-btn icon-btn" onClick={onToggleFull} aria-label="Toggle fullscreen">{isFull ? <FiMinimize /> : <FiMaximize />}</button>
      </div>
    </div>
  );
}

StudioToolbar.propTypes = {
  onUndo: PropTypes.func,
  onRedo: PropTypes.func,
  onSave: PropTypes.func,
  onExport: PropTypes.func,
  onToggleFull: PropTypes.func,
  isFull: PropTypes.bool,
  activeMode: PropTypes.string,
  setActiveMode: PropTypes.func,
  snapEnabled: PropTypes.bool,
  setSnapEnabled: PropTypes.func,
  togglePalette: PropTypes.func,
  toggleProps: PropTypes.func,
  paletteCollapsed: PropTypes.bool,
  propsCollapsed: PropTypes.bool,
};
