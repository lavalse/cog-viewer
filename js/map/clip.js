// Clip tool: draw a sub-bbox, confirm card pops up, write a sub-GeoTIFF.

import { state } from '../state.js';
import { map, sources } from './setup.js';

let clipConfirm = null;

export function startClipDraw(onDone) {
  sources.clip.clear();
  clearClipOverlay();
  const inter = new ol.interaction.Draw({
    source: sources.clip,
    type: 'Circle',
    geometryFunction: ol.interaction.Draw.createBox(),
  });
  inter.on('drawend', (evt) => {
    map.removeInteraction(inter);
    showConfirm(evt.feature);
    if (onDone) onDone();
  });
  map.addInteraction(inter);
  return inter;
}

export function clearClipOverlay() {
  if (clipConfirm) { map.removeOverlay(clipConfirm); clipConfirm = null; }
}

function showConfirm(feature) {
  const bands = state.fetchedBands;
  if (!bands || (!bands.single && !bands.r)) return;
  const ext = feature.getGeometry().getExtent();
  const mp = map.getView().getProjection();
  let cogExt;
  try { cogExt = ol.proj.transformExtent(ext, mp, state.cogProj); }
  catch (e) { return; }
  const fb = state.fetchedBbox;
  cogExt[0] = Math.max(cogExt[0], fb[0]);
  cogExt[1] = Math.max(cogExt[1], fb[1]);
  cogExt[2] = Math.min(cogExt[2], fb[2]);
  cogExt[3] = Math.min(cogExt[3], fb[3]);
  if (cogExt[2] <= cogExt[0] || cogExt[3] <= cogExt[1]) return;
  const resX = (fb[2] - fb[0]) / state.fetchedW;
  const resY = (fb[3] - fb[1]) / state.fetchedH;
  const x0 = Math.max(0, Math.floor((cogExt[0] - fb[0]) / resX));
  const y0 = Math.max(0, Math.floor((fb[3] - cogExt[3]) / resY));
  const x1 = Math.min(state.fetchedW, Math.ceil((cogExt[2] - fb[0]) / resX));
  const y1 = Math.min(state.fetchedH, Math.ceil((fb[3] - cogExt[1]) / resY));
  const pw = x1 - x0, ph = y1 - y0;
  const gw = cogExt[2] - cogExt[0], gh = cogExt[3] - cogExt[1];
  const unit = state.mainImage.getGeoKeys().ProjLinearUnitsGeoKey === 9001 ? 'm' : 'u';
  const szStr = gw > 1000
    ? `${(gw / 1000).toFixed(2)} km × ${(gh / 1000).toFixed(2)} km`
    : `${gw.toFixed(0)} × ${gh.toFixed(0)} ${unit}`;
  const bytes = pw * ph * 4 * (state.renderMode === 'rgb' ? 3 : 1);
  const szBytes = bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;

  const card = document.createElement('div');
  card.className = 'confirm-card';
  card.innerHTML =
    '<div class="title">Clip region</div>' +
    `<div class="meta">${szStr}<br>${pw} × ${ph} px · ~${szBytes}</div>` +
    '<div class="btns"><button class="btn-primary" id="clipDl">Download</button>' +
    '<button class="btn-outline" id="clipCx">Cancel</button></div>';
  clipConfirm = new ol.Overlay({ element: card, positioning: 'bottom-left', offset: [4, -4], stopEvent: true });
  map.addOverlay(clipConfirm);
  clipConfirm.setPosition([ext[2], ext[3]]);
  card.querySelector('#clipDl').onclick = () => downloadClip(cogExt, x0, y0, pw, ph, resX, resY);
  card.querySelector('#clipCx').onclick = () => {
    clearClipOverlay();
    sources.clip.clear();
  };
}

function downloadClip(cogExt, x0, y0, pw, ph, resX, resY) {
  const bands = state.fetchedBands;
  // Single-band clip only for now (keeps GeoTIFF metadata simple).
  // For RGB, write a 3-sample tiff.
  const isRgb = state.renderMode === 'rgb' && bands.r;
  let buf;
  if (isRgb) {
    buf = new Float32Array(pw * ph * 3);
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        const src = (y0 + y) * state.fetchedW + (x0 + x);
        const dst = (y * pw + x) * 3;
        buf[dst] = bands.r[src];
        buf[dst + 1] = bands.g[src];
        buf[dst + 2] = bands.b[src];
      }
    }
  } else {
    buf = new Float32Array(pw * ph);
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        buf[y * pw + x] = bands.single[(y0 + y) * state.fetchedW + (x0 + x)];
      }
    }
  }
  try {
    const metadata = {
      ModelPixelScale: [resX, resY, 0],
      ModelTiepoint: [0, 0, 0, cogExt[0], cogExt[3], 0],
      GeoAsciiParams: 'EPSG:' + state.cogProjCode,
    };
    if (state.cogProjCode >= 1024) metadata.ProjectedCSTypeGeoKey = state.cogProjCode;
    else metadata.GeographicTypeGeoKey = state.cogProjCode;
    const ab = GeoTIFF.writeArrayBuffer(buf, {
      height: ph, width: pw,
      ...(isRgb ? { samplesPerPixel: 3 } : {}),
      ModelPixelScale: [resX, resY, 0],
      ModelTiepoint: [0, 0, 0, cogExt[0], cogExt[3], 0],
      GeoKeys: metadata,
    });
    const blob = new Blob([ab], { type: 'image/tiff' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cog-clip-' + Date.now() + '.tif';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    clearClipOverlay();
    sources.clip.clear();
  } catch (err) {
    console.error('writeArrayBuffer failed:', err);
    alert('GeoTIFF write failed: ' + err.message);
  }
}
