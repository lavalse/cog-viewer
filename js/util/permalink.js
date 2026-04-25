// URL-hash permalink: encode/decode current view state for paste-restorable links.
//
// Hash schema: #u=<encoded url>&b=<minx,miny,maxx,maxy>&s=<size>&pal=<palette>&mode=<single|rgb>&band=<n>

import { state } from '../state.js';

const KEYS = ['u', 'b', 's', 'pal', 'mode', 'band', 'r', 'g', 'b3', 'stretch', 'local'];

export function parseHash() {
  const h = window.location.hash.replace(/^#/, '');
  if (!h) return null;
  const out = {};
  for (const part of h.split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = decodeURIComponent(part.slice(0, eq));
    const v = decodeURIComponent(part.slice(eq + 1));
    out[k] = v;
  }
  return out;
}

export function applyToState(parsed) {
  if (!parsed) return false;
  if (parsed.u) state.url = parsed.u;
  if (parsed.b) {
    const p = parsed.b.split(',').map(Number);
    if (p.length === 4 && p.every(Number.isFinite)) state.selectedBbox = p;
  }
  if (parsed.s) {
    const n = parseInt(parsed.s, 10);
    if (Number.isFinite(n)) state.outSize = n;
  }
  if (parsed.pal) state.palette = parsed.pal;
  if (parsed.mode === 'single' || parsed.mode === 'rgb') state.renderMode = parsed.mode;
  if (parsed.band) {
    const n = parseInt(parsed.band, 10);
    if (Number.isFinite(n)) state.bandPick.single = n;
  }
  if (parsed.r) state.bandPick.r = parseInt(parsed.r, 10);
  if (parsed.g) state.bandPick.g = parseInt(parsed.g, 10);
  if (parsed.b3) state.bandPick.b = parseInt(parsed.b3, 10);
  if (parsed.stretch) {
    const m = parsed.stretch.split(':');
    if (m[0] === 'manual' && m.length === 3) {
      state.stretch = { mode: 'manual', min: parseFloat(m[1]), max: parseFloat(m[2]) };
    } else if (m[0] === 'auto' || m[0] === 'p2-98') {
      state.stretch = { mode: m[0], min: 0, max: 1 };
    }
  }
  return true;
}

export function update() {
  if (!state.url) return;
  if (state.isLocal) {
    window.history.replaceState(null, '', '#local=1');
    return;
  }
  const parts = [];
  parts.push('u=' + encodeURIComponent(state.url));
  if (state.selectedBbox) parts.push('b=' + state.selectedBbox.map((n) => n.toFixed(6)).join(','));
  parts.push('s=' + state.outSize);
  parts.push('pal=' + state.palette);
  parts.push('mode=' + state.renderMode);
  if (state.renderMode === 'rgb') {
    parts.push('r=' + state.bandPick.r);
    parts.push('g=' + state.bandPick.g);
    parts.push('b3=' + state.bandPick.b);
  } else {
    parts.push('band=' + state.bandPick.single);
  }
  if (state.stretch.mode === 'manual') {
    parts.push('stretch=manual:' + state.stretch.min + ':' + state.stretch.max);
  } else {
    parts.push('stretch=' + state.stretch.mode);
  }
  window.history.replaceState(null, '', '#' + parts.join('&'));
}
