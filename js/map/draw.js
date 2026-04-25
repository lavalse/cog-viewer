// Step 2 selection: draw bbox, full extent, clear.

import { state, bus } from '../state.js';
import { map, sources } from './setup.js';

let drawInteraction = null;

export function startDraw(onDone) {
  if (drawInteraction) map.removeInteraction(drawInteraction);
  sources.sel.clear();
  drawInteraction = new ol.interaction.Draw({
    source: sources.sel,
    type: 'Circle',
    geometryFunction: ol.interaction.Draw.createBox(),
  });
  drawInteraction.on('drawend', (evt) => {
    map.removeInteraction(drawInteraction);
    drawInteraction = null;
    handleSelection(evt.feature);
    if (onDone) onDone();
  });
  map.addInteraction(drawInteraction);
}

export function selectFullExtent() {
  if (!state.mainBbox) return;
  sources.sel.clear();
  state.selectedBbox = state.mainBbox.slice();
  const mp = map.getView().getProjection();
  try {
    sources.sel.addFeature(new ol.Feature(
      ol.geom.Polygon.fromExtent(ol.proj.transformExtent(state.mainBbox, state.cogProj, mp))
    ));
  } catch (e) { /* fall through */ }
  bus.emit('selection-changed');
}

export function clearSelection() {
  sources.sel.clear();
  state.selectedBbox = null;
  if (drawInteraction) {
    map.removeInteraction(drawInteraction);
    drawInteraction = null;
  }
  bus.emit('selection-changed');
}

function handleSelection(feature) {
  const ext = feature.getGeometry().getExtent();
  const mp = map.getView().getProjection();
  let cogExt;
  try { cogExt = ol.proj.transformExtent(ext, mp, state.cogProj); }
  catch (e) { cogExt = ol.proj.transformExtent(ext, mp, 'EPSG:4326'); }
  cogExt[0] = Math.max(cogExt[0], state.mainBbox[0]);
  cogExt[1] = Math.max(cogExt[1], state.mainBbox[1]);
  cogExt[2] = Math.min(cogExt[2], state.mainBbox[2]);
  cogExt[3] = Math.min(cogExt[3], state.mainBbox[3]);
  state.selectedBbox = cogExt;
  bus.emit('selection-changed');
}

export function fitToMainBbox() {
  if (!state.mainBbox) return;
  sources.bbox.clear();
  const mp = map.getView().getProjection();
  try {
    const ext = ol.proj.transformExtent(state.mainBbox, state.cogProj, mp);
    sources.bbox.addFeature(new ol.Feature(ol.geom.Polygon.fromExtent(ext)));
    map.getView().fit(ext, { padding: [60, 60, 60, 60] });
  } catch (e) { /* unsupported CRS */ }
}
