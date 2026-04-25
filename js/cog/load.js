// Load COG header from URL or Blob.

import { state, bus } from '../state.js';
import { rawFetch } from '../net.js';
import { isNoData } from './nodata.js';

export async function loadHeaderFromUrl(url) {
  state.url = url;
  state.isLocal = false;
  // HEAD for total file size (used as denominator in net counter).
  try {
    const h = await rawFetch(url, { method: 'HEAD' });
    state.fileSize = parseInt(h.headers.get('Content-Length') || '0', 10);
  } catch (e) {
    state.fileSize = 0;
  }
  state.tiff = await GeoTIFF.fromUrl(url);
  await populateFromTiff();
}

export async function loadHeaderFromBlob(blob, name) {
  state.url = name || ('local://' + (blob.name || 'file.tif'));
  state.isLocal = true;
  state.fileSize = blob.size || 0;
  state.tiff = await GeoTIFF.fromBlob(blob);
  await populateFromTiff();
}

async function populateFromTiff() {
  const tiff = state.tiff;
  state.mainImage = await tiff.getImage(0);
  state.imageCount = await tiff.getImageCount();
  const gk = state.mainImage.getGeoKeys();
  state.cogProjCode = gk.ProjectedCSTypeGeoKey || gk.GeographicTypeGeoKey || 4326;
  state.cogProj = 'EPSG:' + state.cogProjCode;
  state.mainBbox = state.mainImage.getBoundingBox();
  state.samplesPerPixel = state.mainImage.getSamplesPerPixel();
  try { state.photometric = state.mainImage.getPhotometricInterpretation(); }
  catch (e) { state.photometric = null; }

  // Declared GDAL_NODATA, may be string like "-9999".
  try {
    const nd = state.mainImage.getGDALNoData();
    state.cogNoData = (nd !== null && nd !== undefined) ? Number(nd) : null;
  } catch (e) { state.cogNoData = null; }

  // Quick global range from the smallest overview (cheap probe).
  const si = state.imageCount - 1;
  const sm = await tiff.getImage(si);
  const sd = await sm.readRasters();
  const b = sd[0];
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < b.length; i++) {
    const v = b[i];
    if (isNoData(v, state.cogNoData)) continue;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  state.globalMin = mn === Infinity ? 0 : mn;
  state.globalMax = mx === -Infinity ? 1 : mx;

  // Default render mode based on bands.
  state.renderMode = state.samplesPerPixel >= 3 ? 'rgb' : 'single';
  state.bandPick = { single: 0, r: 0, g: 1, b: 2 };

  bus.emit('header-loaded');
}
