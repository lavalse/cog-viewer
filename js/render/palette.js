// Named color ramps. Each ramp is a list of [t, r, g, b] stops; t in [0,1].
// rampSample(name, t) → [r,g,b,a].

const ELEVATION = [
  [0, 30, 80, 180], [0.18, 50, 180, 120], [0.38, 130, 200, 50],
  [0.58, 220, 170, 30], [0.83, 180, 100, 50], [1, 255, 240, 220],
];

// Approximation of matplotlib viridis (8 stops).
const VIRIDIS = [
  [0, 68, 1, 84], [0.143, 71, 44, 122], [0.286, 59, 81, 139],
  [0.429, 44, 113, 142], [0.571, 33, 144, 141], [0.714, 39, 173, 129],
  [0.857, 92, 200, 99], [1, 253, 231, 37],
];

const MAGMA = [
  [0, 0, 0, 4], [0.143, 28, 16, 68], [0.286, 79, 18, 123],
  [0.429, 129, 37, 129], [0.571, 181, 54, 122], [0.714, 229, 80, 100],
  [0.857, 251, 135, 97], [1, 252, 253, 191],
];

const CIVIDIS = [
  [0, 0, 32, 76], [0.25, 36, 71, 117], [0.5, 116, 116, 116],
  [0.75, 168, 161, 86], [1, 253, 234, 73],
];

const TERRAIN = [
  [0, 51, 102, 153], [0.15, 102, 153, 204], [0.3, 153, 204, 102],
  [0.5, 204, 204, 102], [0.7, 153, 102, 51], [0.85, 204, 153, 102],
  [1, 255, 255, 255],
];

const GRAYSCALE = [
  [0, 0, 0, 0], [1, 255, 255, 255],
];

// Diverging blue→white→red, useful for diff layers.
const RDBU_R = [
  [0, 33, 102, 172], [0.25, 103, 169, 207], [0.5, 247, 247, 247],
  [0.75, 239, 138, 98], [1, 178, 24, 43],
];

const RAMPS = {
  elevation: ELEVATION,
  terrain: TERRAIN,
  viridis: VIRIDIS,
  magma: MAGMA,
  cividis: CIVIDIS,
  grayscale: GRAYSCALE,
  rdbu_r: RDBU_R,
};

export function paletteNames() { return Object.keys(RAMPS); }

export function rampSample(name, t) {
  const stops = RAMPS[name] || ELEVATION;
  if (t <= 0) return [stops[0][1], stops[0][2], stops[0][3], 255];
  if (t >= 1) {
    const last = stops[stops.length - 1];
    return [last[1], last[2], last[3], 255];
  }
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i];
      const f = (t - a[0]) / (b[0] - a[0]);
      return [
        Math.round(a[1] + f * (b[1] - a[1])),
        Math.round(a[2] + f * (b[2] - a[2])),
        Math.round(a[3] + f * (b[3] - a[3])),
        255,
      ];
    }
  }
  const last = stops[stops.length - 1];
  return [last[1], last[2], last[3], 255];
}

export function palettePreview(name, w = 80, h = 8) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let x = 0; x < w; x++) {
    const c = rampSample(name, x / (w - 1));
    for (let y = 0; y < h; y++) {
      const o = (y * w + x) * 4;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL();
}
