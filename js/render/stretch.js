// Compute stretch min/max from a band, given a stretch config.

import { isNoData } from '../cog/nodata.js';

export function computeStretch(band, declared, mode, manualMin, manualMax) {
  if (mode === 'manual') return { min: manualMin, max: manualMax };
  if (mode === 'p2-98') return percentileStretch(band, declared, 0.02, 0.98);
  return autoStretch(band, declared);
}

export function autoStretch(band, declared) {
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < band.length; i++) {
    const v = band[i];
    if (isNoData(v, declared)) continue;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  return { min: mn === Infinity ? 0 : mn, max: mx === -Infinity ? 1 : mx };
}

export function percentileStretch(band, declared, lo, hi) {
  // Cheap: build a histogram over the auto range, then walk to find percentile bounds.
  const a = autoStretch(band, declared);
  const range = a.max - a.min || 1;
  const bins = 256;
  const counts = new Uint32Array(bins);
  let total = 0;
  for (let i = 0; i < band.length; i++) {
    const v = band[i];
    if (isNoData(v, declared)) continue;
    let b = Math.floor(((v - a.min) / range) * (bins - 1));
    if (b < 0) b = 0;
    if (b >= bins) b = bins - 1;
    counts[b]++;
    total++;
  }
  if (total === 0) return a;
  const tLo = total * lo, tHi = total * hi;
  let cum = 0, loBin = 0, hiBin = bins - 1;
  for (let i = 0; i < bins; i++) {
    cum += counts[i];
    if (cum >= tLo) { loBin = i; break; }
  }
  cum = 0;
  for (let i = 0; i < bins; i++) {
    cum += counts[i];
    if (cum >= tHi) { hiBin = i; break; }
  }
  return {
    min: a.min + (loBin / (bins - 1)) * range,
    max: a.min + (hiBin / (bins - 1)) * range,
  };
}
