// Profile tool: draw a polyline, sample fetched band along it, render chart.

import { state } from '../state.js';
import { map, sources } from './setup.js';
import { sampleAt } from '../cog/readers.js';

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
    samples.push({ dist: targetDist, value: sampleAt([x, y]) });
  }
  drawChart(samples, total);
}

function drawChart(samples, total) {
  const panel = document.getElementById('profilePanel');
  panel.classList.add('visible');
  const valid = samples.filter((s) => s.value !== null);
  let mn = Infinity, mx = -Infinity;
  valid.forEach((s) => { if (s.value < mn) mn = s.value; if (s.value > mx) mx = s.value; });
  const unit = state.mainImage && state.mainImage.getGeoKeys().ProjLinearUnitsGeoKey === 9001 ? 'm' : 'u';
  const lenStr = total > 1000 ? (total / 1000).toFixed(2) + ' km' : total.toFixed(0) + ' ' + unit;
  document.getElementById('profileMeta').textContent =
    lenStr + '  ·  ' + (Number.isFinite(mn) ? mn.toFixed(1) : '?') + ' — ' + (Number.isFinite(mx) ? mx.toFixed(1) : '?');

  const cv = document.getElementById('profileCanvas');
  const ctx = cv.getContext('2d');
  cv.width = cv.offsetWidth * 2; cv.height = cv.offsetHeight * 2; ctx.scale(2, 2);
  const cw = cv.offsetWidth, ch = cv.offsetHeight;
  const padL = 40, padR = 12, padT = 10, padB = 22;
  const plotW = cw - padL - padR, plotH = ch - padT - padB;
  ctx.clearRect(0, 0, cw, ch);
  if (!Number.isFinite(mn) || !Number.isFinite(mx)) {
    ctx.fillStyle = '#999'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('All points outside fetched region', cw / 2, ch / 2);
    return;
  }
  const range = mx - mn || 1;
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
  ctx.fillText('0', padL, padT + plotH + 14);
  ctx.fillText(lenStr, padL + plotW, padT + plotH + 14);
  ctx.strokeStyle = '#e91e63'; ctx.lineWidth = 1.5; ctx.beginPath();
  let started = false;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s.value === null) { started = false; continue; }
    const x = padL + (s.dist / total) * plotW;
    const y = padT + plotH * (1 - (s.value - mn) / range);
    if (!started) { ctx.moveTo(x, y); started = true; }
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(233,30,99,0.08)';
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.lineTo(padL, padT + plotH);
  ctx.closePath();
  ctx.fill();
}

export function closeProfile() {
  document.getElementById('profilePanel').classList.remove('visible');
  sources.profile.clear();
}
