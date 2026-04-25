// Map construction + reusable vector sources for bbox/selection/profile/clip overlays.

export const sources = {
  bbox: new ol.source.Vector(),
  sel: new ol.source.Vector(),
  profile: new ol.source.Vector(),
  clip: new ol.source.Vector(),
};

const styles = {
  bbox: new ol.style.Style({
    stroke: new ol.style.Stroke({ color: '#2196f3', width: 2, lineDash: [8, 6] }),
    fill: new ol.style.Fill({ color: 'rgba(33,150,243,0.05)' }),
  }),
  sel: new ol.style.Style({
    stroke: new ol.style.Stroke({ color: '#ff9800', width: 2.5 }),
    fill: new ol.style.Fill({ color: 'rgba(255,152,0,0.12)' }),
  }),
  profile: new ol.style.Style({
    stroke: new ol.style.Stroke({ color: '#e91e63', width: 3 }),
    image: new ol.style.Circle({ radius: 4, fill: new ol.style.Fill({ color: '#e91e63' }) }),
  }),
  clip: new ol.style.Style({
    stroke: new ol.style.Stroke({ color: '#9c27b0', width: 2.5, lineDash: [6, 4] }),
    fill: new ol.style.Fill({ color: 'rgba(156,39,176,0.1)' }),
  }),
};

export let map = null;
export let imageLayer = null;

export function buildMap(target) {
  map = new ol.Map({
    target,
    layers: [
      new ol.layer.Tile({ source: new ol.source.OSM() }),
      new ol.layer.Vector({ source: sources.bbox, style: styles.bbox }),
      new ol.layer.Vector({ source: sources.sel, style: styles.sel }),
      new ol.layer.Vector({ source: sources.profile, style: styles.profile }),
      new ol.layer.Vector({ source: sources.clip, style: styles.clip }),
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([138.5, 36.5]),
      zoom: 8,
    }),
  });
  return map;
}

export function setImageLayer(layer) {
  if (imageLayer) map.removeLayer(imageLayer);
  imageLayer = layer;
  if (layer) {
    // Insert beneath the vector overlays so the bbox/selection lines stay visible.
    const layers = map.getLayers();
    layers.insertAt(1, layer);
  }
}

export function clearImageLayer() {
  if (imageLayer) {
    map.removeLayer(imageLayer);
    imageLayer = null;
  }
}
