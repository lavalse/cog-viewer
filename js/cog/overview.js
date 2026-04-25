// Overview ladder + window math.
// Overviews don't have their own geotransform, so derive resolution from
// mainBbox + overview's pixel dimensions.

export function bboxToWindow(image, bbox) {
  const ib = image.getBoundingBox();
  const r = image.getResolution();
  const w = image.getWidth();
  const h = image.getHeight();
  return [
    Math.max(0, Math.floor((bbox[0] - ib[0]) / Math.abs(r[0]))),
    Math.max(0, Math.floor((ib[3] - bbox[3]) / Math.abs(r[1]))),
    Math.min(w, Math.ceil((bbox[2] - ib[0]) / Math.abs(r[0]))),
    Math.min(h, Math.ceil((ib[3] - bbox[1]) / Math.abs(r[1]))),
  ];
}

// Use mainBbox as the geometric reference; overviews share extent but have fewer pixels.
export function bboxToWindowForImage(image, bbox, mainBbox) {
  const w = image.getWidth();
  const h = image.getHeight();
  const west = mainBbox[0], south = mainBbox[1], east = mainBbox[2], north = mainBbox[3];
  const resX = (east - west) / w;
  const resY = (north - south) / h;
  return [
    Math.max(0, Math.floor((bbox[0] - west) / resX)),
    Math.max(0, Math.floor((north - bbox[3]) / resY)),
    Math.min(w, Math.ceil((bbox[2] - west) / resX)),
    Math.min(h, Math.ceil((north - bbox[1]) / resY)),
  ];
}

// Pick the coarsest overview whose ground resolution still satisfies the demand.
export async function selectOverview(tiff, bbox, outSize, mainBbox) {
  const count = await tiff.getImageCount();
  const geoW = Math.abs(mainBbox[2] - mainBbox[0]);
  const geoH = Math.abs(mainBbox[3] - mainBbox[1]);
  const levels = [];
  for (let i = 0; i < count; i++) {
    const img = await tiff.getImage(i);
    const resX = geoW / img.getWidth();
    const resY = geoH / img.getHeight();
    levels.push({ index: i, image: img, resX, resY });
  }
  levels.sort((a, b) => b.resX - a.resX);
  const groundRes = Math.max(
    Math.abs(bbox[2] - bbox[0]) / outSize,
    Math.abs(bbox[3] - bbox[1]) / outSize,
  );
  for (let k = 0; k < levels.length; k++) {
    if (levels[k].resX <= groundRes) {
      return { level: levels[k], groundRes, total: count };
    }
  }
  return { level: levels[levels.length - 1], groundRes, total: count };
}
