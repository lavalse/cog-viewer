// Application bootstrap.

import { state, bus, resetState } from './state.js';
import { registerCRSes } from './crs.js';
import { installNetCounter, renderNetBar, resetNetCounter } from './net.js';
import { buildMap, clearImageLayer } from './map/setup.js';
import { installInfoHover, hideToolbar } from './map/tools.js';
import { installDropZone } from './util/dragdrop.js';
import { parseHash, applyToState, update as updatePermalink } from './util/permalink.js';
import * as datasource from './panels/datasource.js';
import * as selection from './panels/selection.js';
import * as analysis from './panels/analysis.js';
import * as bandcontrols from './panels/bandcontrols.js';
import * as ifdinspector from './panels/ifdinspector.js';
import * as codegen from './panels/codegen.js';
import { fetchSelected } from './cog/readers.js';
import { closeProfile } from './map/profile.js';
import { fitToMainBbox, clearSelection } from './map/draw.js';
import { loadHeaderFromUrl } from './cog/load.js';

(function boot() {
  // 1. CRS + network
  registerCRSes();
  installNetCounter();

  // 2. Map
  buildMap('map');
  installInfoHover();

  // 3. Panels
  datasource.init();
  selection.init();
  analysis.init();
  bandcontrols.init();
  ifdinspector.init();
  codegen.init();

  // 4. Drag-drop
  installDropZone(document.body, () => {
    // After drag-drop, clear selection state
    clearSelection();
    closeProfile();
  });

  // 5. Reset button
  document.getElementById('resetBtn').addEventListener('click', resetAll);

  // 6. Net bar
  bus.on('net-update', () => renderNetBar(document.getElementById('netBar')));

  // 7. Permalink: parse hash, fill URL field, optionally auto-load.
  const parsed = parseHash();
  if (parsed) {
    if (parsed.u) {
      document.getElementById('cogUrl').value = parsed.u;
      applyToState(parsed);
      // Auto-load.
      tryAutoLoad(parsed);
    }
    if (parsed.local === '1') {
      datasource.showStatus('Local-file permalink — drop the file again to restore.', 'info');
    }
  }
})();

async function tryAutoLoad(parsed) {
  try {
    await loadHeaderFromUrl(parsed.u);
    if (parsed.b && state.selectedBbox) {
      // already applied to state
      bus.emit('selection-changed');
      // Auto-fetch when bbox came from URL
      try { await fetchSelected(); } catch (e) { console.error(e); }
    }
  } catch (e) {
    console.error('autoload failed', e);
  }
}

function resetAll() {
  clearImageLayer();
  resetNetCounter();
  resetState();
  state.outSize = parseInt(document.getElementById('resSel').value, 10) || 256;
  state.palette = 'elevation';
  state.stretch = { mode: 'auto', min: 0, max: 1 };
  state.renderMode = 'single';
  state.bandPick = { single: 0, r: 0, g: 1, b: 2 };
  document.getElementById('statusEl').className = '';
  document.getElementById('statusEl').textContent = '';
  document.getElementById('netBar').classList.add('hidden');
  document.getElementById('infoSection').classList.add('hidden');
  document.getElementById('ifdSection').classList.add('hidden');
  document.getElementById('analysisResults').classList.add('hidden');
  document.getElementById('hoverPanel').classList.add('hidden');
  document.getElementById('mapTooltip').style.display = 'none';
  document.getElementById('selInfo').textContent = 'No region selected';
  document.getElementById('fetchBtn').disabled = true;
  document.getElementById('bandControls').classList.add('hidden');
  document.getElementById('codegenSection').classList.add('hidden');
  datasource.setCardState(1, 'active');
  datasource.setCardState(2, 'locked');
  datasource.setCardState(3, 'locked');
  closeProfile();
  hideToolbar();
  window.history.replaceState(null, '', window.location.pathname);
}
