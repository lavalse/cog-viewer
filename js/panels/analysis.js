// Step 3 panel: stats + histogram for single-band fetched data.

import { state, bus } from '../state.js';
import { isNoData } from '../cog/nodata.js';
import { rampSample } from '../render/palette.js';
import { setCardState, showStatus } from './datasource.js';

export function init() {
  document.getElementById('analyzeBtn').addEventListener('click', run);
  bus.on('fetched', () => {
    document.getElementById('analysisResults').classList.add('hidden');
  });
}

function run() {
  const bands = state.fetchedBands;
  if (!bands) return;
  // Single-band: one histogram. RGB: pick the green channel as a representative.
  const band = bands.single || bands.g;
  if (!band) return;

  let mn = Infinity, mx = -Infinity, s = 0, c = 0, nd = 0;
  for (let i = 0; i < band.length; i++) {
    const v = band[i];
    if (isNoData(v, state.cogNoData)) { nd++; continue; }
    if (v < mn) mn = v;
    if (v > mx) mx = v;
    s += v; c++;
  }
  const stats = { min: c > 0 ? mn : 0, max: c > 0 ? mx : 0, mean: c > 0 ? s / c : 0, count: c, nodata: nd };

  document.getElementById('statsGrid').innerHTML =
    `<div class="stat-box"><div class="val">${stats.min.toFixed(1)}</div><div class="lbl">Min</div></div>` +
    `<div class="stat-box"><div class="val">${stats.max.toFixed(1)}</div><div class="lbl">Max</div></div>` +
    `<div class="stat-box"><div class="val">${stats.mean.toFixed(1)}</div><div class="lbl">Mean</div></div>` +
    `<div class="stat-box"><div class="val">${stats.count}</div><div class="lbl">Valid</div></div>`;

  document.getElementById('analysisResults').classList.remove('hidden');

  const cv = document.getElementById('histogram');
  const ctx = cv.getContext('2d');
  cv.width = cv.offsetWidth * 2; cv.height = cv.offsetHeight * 2; ctx.scale(2, 2);
  const cw = cv.offsetWidth, ch = cv.offsetHeight;
  ctx.clearRect(0, 0, cw, ch);
  if (stats.count > 0) {
    const bins = 50;
    const range = stats.max - stats.min || 1;
    const counts = new Array(bins).fill(0);
    for (let i = 0; i < band.length; i++) {
      const v = band[i];
      if (isNoData(v, state.cogNoData)) continue;
      let b = Math.floor(((v - stats.min) / range) * (bins - 1));
      if (b < 0) b = 0;
      if (b >= bins) b = bins - 1;
      counts[b]++;
    }
    const mxc = Math.max.apply(null, counts);
    const bw = cw / bins;
    for (let i = 0; i < bins; i++) {
      const bh = mxc > 0 ? (counts[i] / mxc) * (ch - 14) : 0;
      const c = rampSample(state.palette, i / (bins - 1));
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.fillRect(i * bw, ch - 12 - bh, bw - 0.5, bh);
    }
    ctx.fillStyle = '#888'; ctx.font = '9px sans-serif';
    ctx.textAlign = 'left'; ctx.fillText(stats.min.toFixed(0), 2, ch - 2);
    ctx.textAlign = 'right'; ctx.fillText(stats.max.toFixed(0), cw - 2, ch - 2);
  }
  setCardState(3, 'done');
  const total = stats.count + stats.nodata;
  const pct = total > 0 ? Math.round(stats.count / total * 100) : 0;
  showStatus(`Analysis: ${stats.count} valid (${pct}%), ${stats.nodata} NoData`, 'ok');
}
