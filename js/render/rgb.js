// Three-band RGB compose with per-channel stretch.

import { state } from '../state.js';
import { isNoData } from '../cog/nodata.js';

export function renderRgbToCanvas(r, g, b, w, h, stretches) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(w, h);
  const px = imgData.data;
  const sr = stretches.r, sg = stretches.g, sb = stretches.b;
  const rr = (sr.max - sr.min) || 1, gr = (sg.max - sg.min) || 1, br = (sb.max - sb.min) || 1;
  for (let i = 0; i < r.length; i++) {
    const off = i * 4;
    const vr = r[i], vg = g[i], vb = b[i];
    if (isNoData(vr, state.cogNoData) || isNoData(vg, state.cogNoData) || isNoData(vb, state.cogNoData)) {
      px[off] = px[off + 1] = px[off + 2] = px[off + 3] = 0;
      continue;
    }
    px[off] = clip255((vr - sr.min) / rr);
    px[off + 1] = clip255((vg - sg.min) / gr);
    px[off + 2] = clip255((vb - sb.min) / br);
    px[off + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function clip255(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 255;
  return Math.round(t * 255);
}
