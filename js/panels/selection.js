// Step 2 panel: draw / full-extent / clear + fetch button.

import { state, bus } from '../state.js';
import { startDraw, selectFullExtent, clearSelection } from '../map/draw.js';
import { fetchSelected } from '../cog/readers.js';
import { bboxToWindow } from '../cog/overview.js';
import { renderSingleToCanvas } from '../render/single.js';
import { renderRgbToCanvas } from '../render/rgb.js';
import { computeStretch } from '../render/stretch.js';
import { setImageLayer, map } from '../map/setup.js';
import { showStatus, setCardState } from './datasource.js';
import { update as updatePermalink } from '../util/permalink.js';
import { showToolbar, setTool } from '../map/tools.js';

export function init() {
  document.getElementById('drawBtn').addEventListener('click', () => {
    startDraw();
    showStatus('Click and drag on the map', 'info');
  });
  document.getElementById('fullExtentBtn').addEventListener('click', () => {
    selectFullExtent();
    showStatus('Full extent selected — click Fetch', 'ok');
  });
  document.getElementById('clearSelBtn').addEventListener('click', clearSelection);
  document.getElementById('fetchBtn').addEventListener('click', onFetch);
  document.getElementById('resSel').addEventListener('change', (e) => {
    state.outSize = parseInt(e.target.value, 10);
    updatePermalink();
  });

  bus.on('selection-changed', updateSelInfo);
  bus.on('header-loaded', () => {
    document.getElementById('fetchBtn').disabled = true;
    document.getElementById('selInfo').textContent = 'No region selected';
  });
  bus.on('fetched', renderFetched);
  bus.on('refetch-requested', onFetch);
  bus.on('rerender-requested', renderFetched);
}

function updateSelInfo() {
  const el = document.getElementById('selInfo');
  if (!state.selectedBbox) {
    el.textContent = 'No region selected';
    document.getElementById('fetchBtn').disabled = true;
    return;
  }
  const win = bboxToWindow(state.mainImage, state.selectedBbox);
  const pw = win[2] - win[0], ph = win[3] - win[1];
  const gw = Math.abs(state.selectedBbox[2] - state.selectedBbox[0]);
  const gh = Math.abs(state.selectedBbox[3] - state.selectedBbox[1]);
  const u = state.mainImage.getGeoKeys().ProjLinearUnitsGeoKey === 9001 ? 'm' : 'units';
  el.textContent = `${gw.toFixed(0)} × ${gh.toFixed(0)} ${u} (${pw} × ${ph} native px)`;
  document.getElementById('fetchBtn').disabled = false;
  updatePermalink();
}

async function onFetch() {
  if (!state.selectedBbox) return;
  showStatus('Fetching...', 'info');
  try {
    await fetchSelected();
  } catch (err) {
    console.error(err);
    showStatus('Fetch error: ' + err.message, 'err');
  }
}

function renderFetched() {
  const bands = state.fetchedBands;
  if (!bands) return;
  let canvas;
  if (state.renderMode === 'rgb' && bands.r) {
    const stretches = {
      r: computeStretch(bands.r, state.cogNoData, state.stretch.mode === 'manual' ? 'auto' : state.stretch.mode),
      g: computeStretch(bands.g, state.cogNoData, state.stretch.mode === 'manual' ? 'auto' : state.stretch.mode),
      b: computeStretch(bands.b, state.cogNoData, state.stretch.mode === 'manual' ? 'auto' : state.stretch.mode),
    };
    canvas = renderRgbToCanvas(bands.r, bands.g, bands.b, state.fetchedW, state.fetchedH, stretches);
  } else {
    const s = computeStretch(bands.single, state.cogNoData, state.stretch.mode, state.stretch.min, state.stretch.max);
    state.localMin = s.min; state.localMax = s.max;
    canvas = renderSingleToCanvas(bands.single, state.fetchedW, state.fetchedH, s.min, s.max, state.palette);
  }
  const olProj = ol.proj.get(state.cogProj) || ol.proj.get('EPSG:4326');
  const layer = new ol.layer.Image({
    source: new ol.source.ImageStatic({
      url: canvas.toDataURL('image/png'),
      projection: olProj,
      imageExtent: state.fetchedBbox,
    }),
    opacity: 1,
  });
  setImageLayer(layer);

  setCardState(2, 'done');
  setCardState(3, 'active');
  document.getElementById('hoverPanel').classList.remove('hidden');
  document.getElementById('analysisResults').classList.add('hidden');
  showStatus(`Fetched ${state.fetchedW}×${state.fetchedH} · values: ${state.localMin.toFixed(1)} ~ ${state.localMax.toFixed(1)}`, 'ok');
  showToolbar();
  setTool('info');
  updatePermalink();
}
