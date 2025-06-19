import React from 'react';
import ReactDOM from 'react-dom/client';
import UnifiedViewer from './UnifiedViewer.jsx';
import { startThreeViewer } from './threeViewer.js';

// Shared state for 2D/3D communication
window.electrodeState = {
  selectedGroups: [[], [], [], []],
  currentGroup: 0,
  groupSize: 2,
  combinations: [],
  onElectrodeSelect: null,
  onGroupChange: null,
  onReset: null
};

// Mount React 2D panel
ReactDOM.createRoot(document.getElementById('react-root')).render(
  <UnifiedViewer electrodeState={window.electrodeState} />
);

// Start Three.js viewer
startThreeViewer(window.electrodeState); 