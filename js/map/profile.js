// Profile tool: draw a polyline, sample fetched band along it, render chart.

import { state } from '../state.js';
import { map, sources } from './setup.js';
import { sampleAt, sampleRgbAt } from '../cog/readers.js';

// Cache the last drawn series so a window resize can re-render without resampling.
let lastSamples = null, lastTotal = 0, lastIsRgb = false;

window.addEventListener('resize', () => {
  if (lastSamples) drawChart(lastSamples, lastTotal, lastIsRgb);
});

export function startProfileDraw(onDone) {
  sources.profile.clear();
  const inter = new ol.interaction.Draw({ source: sources.profile, type: 'LineString' });
  inter.on('drawend', (evt) => {
    map.removeInteraction(inter);
    renderProfile(evt.feature);
    if (onDone) onDone();
  });
  map.addInteraction(inter);
  return inter;
}

function renderProfile(feature) {
  const coords = feature.getGeometry().getCoordinates();
  const mp = map.getView().getProjection();
  const cogCoords = coords.map((c) => {
    try { return ol.proj.transform(c, mp, state.cogProj); }
    catch (e) { return null; }
  }).filter((c) => c);
  if (cogCoords.length < 2) { closeProfile(); return; }
  const segLens = [];
  let total = 0;
  for (let i = 1; i < cogCoords.length; i++) {
    const dx = cogCoords[i][0] - cogCoords[i - 1][0];
    const dy = cogCoords[i][1] - cogCoords[i - 1][1];
    const d = Math.sqrt(dx * dx + dy * dy);
    segLens.push(d);
    total += d;
  }
  const stride = state.lastOverview ? state.lastOverview.level.resX : 1;
  const N = Math.min(300, Math.max(50, Math.floor(total / Math.max(0.5, stride))));
  const isRgb = state.renderMode === 'rgb' && state.fetchedBands && state.fetchedBands.r;
  const sampler = isRgb ? sampleRgbAt : sampleAt;
  const samples = [];
  for (let k = 0; k < N; k++) {
    const t = k / (N - 1);
    const targetDist = t * total;
    let accum = 0, si = 0;
    for (si = 0; si < segLens.length; si++) {
      if (accum + segLens[si] >= targetDist || si === segLens.length - 1) break;
      accum += segLens[si];
    }
    const segT = segLens[si] > 0 ? (targetDist - accum) / segLens[si] : 0;
    const x = cogCoords[si][0] + segT * (cogCoords[si + 1][0] - cogCoords[si][0]);
    const y = cogCoords[si][1] + segT * (cogCoords[si + 1][1] - cogCoords[si][1]);
    samples.push({ dist: targetDist, value: sampler([x, y]) });
  }
  drawChart(samples, total, isRgb);
}

function drawChart(samples, total, isRgb) {
  lastSamples = samples; lastTotal = total; lastIsRgb = isRgb;
  const panel = document.getElementById('profilePanel');
  panel.classList.add('visible');

  // Find global min/max across whichever channels we have.
  let mn = Infinity, mx = -Infinity;
  for (const s of samples) {
    const v = s.value;
    if (v == null) continue;
    if (Array.isArray(v)) {
      for (const c of v) {
        if (c == null || Number.isNaN(c)) continue;
        if (c < mn) mn = c;
        if (c > mx) mx = c;
      }
    } else if (!Number.isNaN(v)) {
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
  }

  const unit = state.mainImage && state.mainImage.getGeoKeys().ProjLinearUnitsGeoKey === 9001 ? 'm' : 'u';
  const lenStr = total > 1000 ? (total / 1000).toFixed(2) + ' km' : total.toFixed(0) + ' ' + unit;
  const rangeStr = (Number.isFinite(mn) && Number.isFinite(mx))
    ? `${mn.toFixed(1)} — ${mx.toFixed(1)}` + (isRgb ? ' (R·G·B)' : '')
    : '?';
  document.getElementById('profileMeta').textContent = `${lenStr}  ·  ${rangeStr}`;

  const cv = document.getElementById('profileCanvas');
  const ctx = cv.getContext('2d');
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  cv.width = cv.offsetWidth * dpr;
  cv.height = cv.offsetHeight * dpr;
  ctx.scale(dpr, dpr);
  const cw = cv.offsetWidth, ch = cv.offsetHeight;
  const padL = 40, padR = 12, padT = 10, padB = 28;
  const plotW = cw - padL - padR, plotH = ch - padT - padB;
  ctx.clearRect(0, 0, cw, ch);
  if (!Number.isFinite(mn) || !Number.isFinite(mx)) {
    ctx.fillStyle = '#999'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('No data along this line (try drawing inside the rendered region)', cw / 2, ch / 2);
    return;
  }
  const range = mx - mn || 1;

  // Axes
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();
  ctx.fillStyle = '#888'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = padT + plotH * (1 - i / 4), v = mn + range * (i / 4);
    ctx.fillText(v.toFixed(0), padL - 4, y + 3);
    ctx.strokeStyle = '#f0f0f0';
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('0', padL, padT + plotH + 6);
  ctx.fillText(lenStr, padL + plotW, padT + plotH + 6);
  ctx.textBaseline = 'alphabetic';

  if (isRgb) {
    drawSeries(ctx, samples, total, mn, range, padL, padT, plotW, plotH, 0, '#d32f2f'); // R
    drawSeries(ctx, samples, total, mn, range, padL, padT, plotW, plotH, 1, '#388e3c'); // G
    drawSeries(ctx, samples, total, mn, range, padL, padT, plotW, plotH, 2, '#1976d2'); // B
  } else {
    drawSeries(ctx, samples, total, mn, range, padL, padT, plotW, plotH, null, '#e91e63');
  }
}

function drawSeries(ctx, samples, total, mn, range, padL, padT, plotW, plotH, channel, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let started = false;
  for (const s of samples) {
    let v = s.value;
    if (v == null) { started = false; continue; }
    if (channel !== null) v = Array.isArray(v) ? v[channel] : null;
    if (v == null || Number.isNaN(v)) { started = false; continue; }
    const x = padL + (s.dist / total) * plotW;
    const y = padT + plotH * (1 - (v - mn) / range);
    if (!started) { ctx.moveTo(x, y); started = true; }
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export function closeProfile() {
  document.getElementById('profilePanel').classList.remove('visible');
  sources.profile.clear();
  lastSamples = null;
}
