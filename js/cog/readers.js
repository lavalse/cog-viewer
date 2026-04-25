// Fetch pixel data for a selected bbox.

import { state, bus } from '../state.js';
import { selectOverview, bboxToWindowForImage } from './overview.js';
import { isNoData } from './nodata.js';

export async function fetchSelected() {
  if (!state.selectedBbox || !state.mainImage) return;
  const sel = await selectOverview(state.tiff, state.selectedBbox, state.outSize, state.mainBbox);
  const image = sel.level.image;
  const win = bboxToWindowForImage(image, state.selectedBbox, state.mainBbox);
  state.lastOverview = sel;

  if (state.renderMode === 'rgb' && state.samplesPerPixel >= 3) {
    const samples = [
      state.bandPick.r ?? 0,
      state.bandPick.g ?? 1,
      state.bandPick.b ?? 2,
    ];
    const data = await image.readRasters({
      window: win, width: state.outSize, height: state.outSize,
      samples, interleave: false,
    });
    state.fetchedBands = { r: data[0], g: data[1], b: data[2] };
  } else {
    const samples = [state.bandPick.single ?? 0];
    const data = await image.readRasters({
      window: win, width: state.outSize, height: state.outSize,
      samples, interleave: false,
    });
    state.fetchedBands = { single: data[0] };
  }

  state.fetchedBbox = state.selectedBbox.slice();
  state.fetchedW = state.outSize;
  state.fetchedH = state.outSize;

  // Compute local range across whichever bands are loaded (used for default stretch).
  let mn = Infinity, mx = -Infinity;
  const bands = state.fetchedBands;
  for (const key in bands) {
    const b = bands[key];
    for (let i = 0; i < b.length; i++) {
      const v = b[i];
      if (isNoData(v, state.cogNoData)) continue;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
  }
  state.localMin = mn === Infinity ? 0 : mn;
  state.localMax = mx === -Infinity ? 1 : mx;

  bus.emit('fetched');
}

// Sample value at a CRS coordinate (single-band only). Returns null if NoData / out of range.
export function sampleAt(cc) {
  const bands = state.fetchedBands;
  if (!bands || !bands.single || !state.fetchedBbox) return null;
  const bb = state.fetchedBbox;
  if (cc[0] < bb[0] || cc[0] > bb[2] || cc[1] < bb[1] || cc[1] > bb[3]) return null;
  const px = Math.floor((cc[0] - bb[0]) / (bb[2] - bb[0]) * state.fetchedW);
  const py = Math.floor((bb[3] - cc[1]) / (bb[3] - bb[1]) * state.fetchedH);
  if (px < 0 || px >= state.fetchedW || py < 0 || py >= state.fetchedH) return null;
  const v = bands.single[py * state.fetchedW + px];
  return isNoData(v, state.cogNoData) ? null : v;
}

// Sample three-band RGB at a CRS coord. Returns [r,g,b] or null.
export function sampleRgbAt(cc) {
  const bands = state.fetchedBands;
  if (!bands || !bands.r || !state.fetchedBbox) return null;
  const bb = state.fetchedBbox;
  if (cc[0] < bb[0] || cc[0] > bb[2] || cc[1] < bb[1] || cc[1] > bb[3]) return null;
  const px = Math.floor((cc[0] - bb[0]) / (bb[2] - bb[0]) * state.fetchedW);
  const py = Math.floor((bb[3] - cc[1]) / (bb[3] - bb[1]) * state.fetchedH);
  if (px < 0 || px >= state.fetchedW || py < 0 || py >= state.fetchedH) return null;
  const idx = py * state.fetchedW + px;
  return [bands.r[idx], bands.g[idx], bands.b[idx]];
}
