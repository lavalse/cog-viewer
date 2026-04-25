// Single-band → canvas → ImageStatic layer.

import { state } from '../state.js';
import { rampSample } from './palette.js';
import { isNoData } from '../cog/nodata.js';

export function renderSingleToCanvas(band, w, h, mn, mx, palette) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(w, h);
  const px = imgData.data;
  const range = (mx - mn) || 1;
  for (let i = 0; i < band.length; i++) {
    const off = i * 4;
    const v = band[i];
    if (isNoData(v, state.cogNoData)) {
      px[off] = px[off + 1] = px[off + 2] = px[off + 3] = 0;
    } else {
      const t = Math.max(0, Math.min(1, (v - mn) / range));
      const c = rampSample(palette, t);
      px[off] = c[0]; px[off + 1] = c[1]; px[off + 2] = c[2]; px[off + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
