import React from 'react';
import PropTypes from 'prop-types';
import Outliner from './Outliner';

export default function OutlinerPanel({ workspaceRef, onSelect, outlinerSearch, setOutlinerSearch, pushToast }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Outliner
        workspaceRef={workspaceRef}
        onSelect={onSelect}
        outlinerSearch={outlinerSearch}
        setOutlinerSearch={setOutlinerSearch}
        pushToast={pushToast}
      />
    </div>
  );
}

OutlinerPanel.propTypes = {
  workspaceRef: PropTypes.object,
  onSelect: PropTypes.func,
  outlinerSearch: PropTypes.string,
  setOutlinerSearch: PropTypes.func,
  pushToast: PropTypes.func,
};
