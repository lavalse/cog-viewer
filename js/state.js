// Global state singleton + tiny pub/sub bus.
// Modules import {state, bus}; never import each other's internals.

export const state = {
  // dataset
  url: null,
  isLocal: false,
  fileSize: 0,
  tiff: null,
  mainImage: null,
  imageCount: 0,
  cogProj: null,
  cogProjCode: null,
  mainBbox: null,
  cogNoData: null,
  globalMin: 0,
  globalMax: 1,
  samplesPerPixel: 1,
  photometric: null,

  // selection / fetch
  selectedBbox: null,
  outSize: 256,
  lastOverview: null,
  // For single-band: { single: TypedArray }; for RGB: { r, g, b: TypedArrays }
  fetchedBands: null,
  fetchedBbox: null,
  fetchedW: 0,
  fetchedH: 0,
  localMin: 0,
  localMax: 1,

  // render
  renderMode: 'single',     // 'single' | 'rgb'
  bandPick: { single: 0, r: 0, g: 1, b: 2 },
  palette: 'elevation',
  stretch: { mode: 'auto', min: 0, max: 1 },  // mode: 'auto' | 'p2-98' | 'manual'

  // network
  netBytes: 0,
  netReqs: 0,
};

const listeners = new Map();

export const bus = {
  on(evt, fn) {
    if (!listeners.has(evt)) listeners.set(evt, new Set());
    listeners.get(evt).add(fn);
    return () => listeners.get(evt)?.delete(fn);
  },
  emit(evt, payload) {
    const set = listeners.get(evt);
    if (!set) return;
    for (const fn of set) {
      try { fn(payload); } catch (e) { console.error('[bus]', evt, e); }
    }
  },
};

export function resetState() {
  state.url = null;
  state.isLocal = false;
  state.fileSize = 0;
  state.tiff = null;
  state.mainImage = null;
  state.imageCount = 0;
  state.cogProj = null;
  state.cogProjCode = null;
  state.mainBbox = null;
  state.cogNoData = null;
  state.globalMin = 0;
  state.globalMax = 1;
  state.samplesPerPixel = 1;
  state.photometric = null;
  state.selectedBbox = null;
  state.lastOverview = null;
  state.fetchedBands = null;
  state.fetchedBbox = null;
  state.fetchedW = 0;
  state.fetchedH = 0;
  state.localMin = 0;
  state.localMax = 1;
  state.netBytes = 0;
  state.netReqs = 0;
}
