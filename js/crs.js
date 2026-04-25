// Register Japanese plane rectangular CRSes (EPSG:6669-6687).
// Must run before any ol.proj transform involving them.

const JP_ZONES = [
  [6669, 129.5, 33], [6670, 131, 33], [6671, 132.166667, 36], [6672, 133.5, 33],
  [6673, 134.333333, 36], [6674, 136, 36], [6675, 137.166667, 36], [6676, 138.5, 36],
  [6677, 139.833333, 36], [6678, 140.833333, 40], [6679, 140.25, 44], [6680, 142.25, 44],
  [6681, 144.25, 44], [6682, 142, 26], [6683, 127.5, 26], [6684, 124, 26], [6685, 131, 26],
  [6686, 136, 20], [6687, 154, 26],
];

export function registerCRSes() {
  for (const [code, lon, lat] of JP_ZONES) {
    proj4.defs(
      'EPSG:' + code,
      `+proj=tmerc +lat_0=${lat} +lon_0=${lon} +k=0.9999 +x_0=0 +y_0=0 ` +
      '+ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs'
    );
  }
  ol.proj.proj4.register(proj4);
}
