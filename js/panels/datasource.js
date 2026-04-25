// Step 1 panel: URL input + Load Header button + file info display.

import { state, bus } from '../state.js';
import { loadHeaderFromUrl } from '../cog/load.js';
import { fitToMainBbox } from '../map/draw.js';

export function init() {
  document.getElementById('loadHeaderBtn').addEventListener('click', onLoad);
  document.getElementById('cogUrl').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onLoad();
  });
  bus.on('header-loaded', renderInfo);
  bus.on('header-loaded', () => {
    fitToMainBbox();
    setCardState(1, 'done');
    setCardState(2, 'active');
    showStatus('Header loaded — draw a box to select a region', 'ok');
  });
}

async function onLoad() {
  // Strip all whitespace — paths from chat / wrapped emails sometimes pick up
  // stray spaces or line breaks that URL-encode to %20 and produce 404s.
  const raw = document.getElementById('cogUrl').value;
  const url = raw.replace(/\s+/g, '');
  if (!url) { showStatus('Enter a URL', 'err'); return; }
  if (url !== raw.trim()) {
    document.getElementById('cogUrl').value = url;
    showStatus('Stripped whitespace from URL — loading...', 'info');
  } else {
    showStatus('Loading header...', 'info');
  }
  try {
    await loadHeaderFromUrl(url);
  } catch (err) {
    console.error(err);
    showStatus('Error: ' + err.message, 'err');
  }
}

export function renderInfo() {
  const img = state.mainImage;
  if (!img) return;
  const gk = img.getGeoKeys();
  const r = img.getResolution();
  const bps = img.getBitsPerSample();
  const sf = img.getSampleFormat();
  const dt = { 1: 'UInt', 2: 'Int', 3: 'Float' };
  const u = gk.ProjLinearUnitsGeoKey === 9001 ? 'm' : 'units';
  let html = '';
  html += `<dt>CRS</dt><dd>EPSG:${state.cogProjCode}</dd>`;
  html += `<dt>Size</dt><dd>${img.getWidth()} × ${img.getHeight()} px</dd>`;
  html += `<dt>Bands</dt><dd>${img.getSamplesPerPixel()}</dd>`;
  html += `<dt>Type</dt><dd>${dt[sf] || '?'}${bps}</dd>`;
  html += `<dt>Res</dt><dd>${Math.abs(r[0])} ${u}/px</dd>`;
  html += `<dt>Overviews</dt><dd>${state.imageCount - 1}</dd>`;
  html += `<dt>Values</dt><dd>${state.globalMin.toFixed(1)} ~ ${state.globalMax.toFixed(1)}</dd>`;
  html += `<dt>NoData</dt><dd>${state.cogNoData !== null ? state.cogNoData + ' (declared)' : 'auto: ±1e30, -9999, ±32768'}</dd>`;
  if (state.fileSize > 0) html += `<dt>File</dt><dd>${(state.fileSize / 1024 / 1024).toFixed(1)} MB</dd>`;
  if (state.isLocal) html += `<dt>Source</dt><dd>local file</dd>`;
  document.getElementById('infoGrid').innerHTML = html;
  document.getElementById('infoSection').classList.remove('hidden');
}

export function showStatus(m, t) {
  const el = document.getElementById('statusEl');
  el.className = 'status ' + (t || '');
  el.textContent = m;
}

export function setCardState(n, st) {
  const card = document.getElementById('card' + n);
  const num = document.getElementById('n' + n);
  card.classList.remove('active', 'done', 'locked');
  num.classList.remove('active', 'done');
  if (st === 'active') { card.classList.add('active'); num.classList.add('active'); }
  else if (st === 'done') { card.classList.add('done'); num.classList.add('done'); }
  else card.classList.add('locked');
}
