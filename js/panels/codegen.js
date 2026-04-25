// Copy-as-Python panel: emits rasterio / rioxarray snippets that reproduce the current view.

import { state, bus } from '../state.js';

const RASTERIO_TPL = `# Reproduces the current view from the COG viewer.
# Reads only the bytes inside the selected window from overview level {{OV}} of {{OV_TOTAL_M1}}.
import rasterio
from rasterio.windows import from_bounds

URL    = "{{URL}}"
BOUNDS = ({{W}}, {{S}}, {{E}}, {{N}})   # west, south, east, north — EPSG:{{EPSG}}
OUT    = ({{OUT}}, {{OUT}})              # (height, width) after decimation

# /vsicurl/ streams Range requests over HTTPS without downloading the whole file.
# OVERVIEW_LEVEL pins the IFD; "-1" lets GDAL pick. We pin to match the viewer.
with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", OVERVIEW_LEVEL="{{OV}}"):
    with rasterio.open(f"/vsicurl/{URL}") as src:
        win = from_bounds(*BOUNDS, transform=src.transform)
        arr = src.read({{BAND_LIST}}, window=win, out_shape=OUT,
                       resampling=rasterio.enums.Resampling.bilinear)
        nodata = src.nodata if src.nodata is not None else {{NODATA}}

print(arr.shape, arr.dtype, "nodata=", nodata)
`;

const RIOXARRAY_TPL = `# Same view via rioxarray (xarray + rasterio under the hood).
import rioxarray

URL    = "{{URL}}"
BOUNDS = ({{W}}, {{S}}, {{E}}, {{N}})    # EPSG:{{EPSG}}

# overview_level={{OV}} opens the matching IFD directly — no full-res read.
da = rioxarray.open_rasterio(URL, overview_level={{OV}}, masked=True, chunks=True)
clipped = da.rio.clip_box(*BOUNDS, crs="EPSG:{{EPSG}}")
print(clipped.shape, clipped.dtype, "crs=", clipped.rio.crs)
`;

const RASTERIO_LOCAL_TPL = `# Local file — replace LOCAL_PATH with the .tif path you dropped into the viewer.
import rasterio
from rasterio.windows import from_bounds

LOCAL_PATH = "/path/to/{{LOCAL_NAME}}"
BOUNDS = ({{W}}, {{S}}, {{E}}, {{N}})   # EPSG:{{EPSG}}
OUT    = ({{OUT}}, {{OUT}})

with rasterio.Env(OVERVIEW_LEVEL="{{OV}}"):
    with rasterio.open(LOCAL_PATH) as src:
        win = from_bounds(*BOUNDS, transform=src.transform)
        arr = src.read({{BAND_LIST}}, window=win, out_shape=OUT)
        nodata = src.nodata if src.nodata is not None else {{NODATA}}

print(arr.shape, arr.dtype)
`;

let activeTab = 'rasterio';

export function init() {
  bus.on('fetched', renderPanel);
  document.getElementById('codegenSection').classList.add('hidden');
  document.querySelectorAll('.codegen-tab').forEach((t) => {
    t.addEventListener('click', () => {
      activeTab = t.dataset.tab;
      document.querySelectorAll('.codegen-tab').forEach((b) => {
        b.classList.toggle('active', b === t);
      });
      renderPanel();
    });
  });
  document.getElementById('codegenCopy').addEventListener('click', copyToClipboard);
}

function renderPanel() {
  if (!state.lastOverview || !state.selectedBbox) {
    document.getElementById('codegenSection').classList.add('hidden');
    return;
  }
  document.getElementById('codegenSection').classList.remove('hidden');
  const code = generateCode(activeTab);
  document.getElementById('codegenOutput').textContent = code;
}

function generateCode(tab) {
  const subs = buildSubs();
  if (state.isLocal && tab === 'rasterio') return fill(RASTERIO_LOCAL_TPL, subs);
  if (tab === 'rasterio') return fill(RASTERIO_TPL, subs);
  return fill(RIOXARRAY_TPL, subs);
}

function buildSubs() {
  const bb = state.selectedBbox;
  const ov = state.lastOverview;
  const bandList = state.renderMode === 'rgb'
    ? `[${(state.bandPick.r ?? 0) + 1}, ${(state.bandPick.g ?? 1) + 1}, ${(state.bandPick.b ?? 2) + 1}]`
    : String((state.bandPick.single ?? 0) + 1);
  const url = state.isLocal ? '<dropped local file>' : (state.url || '');
  const localName = state.isLocal && state.url ? state.url.replace(/^local:\/\//, '') : 'file.tif';
  return {
    URL: url,
    LOCAL_NAME: localName,
    EPSG: state.cogProjCode,
    W: bb[0], S: bb[1], E: bb[2], N: bb[3],
    OUT: state.outSize,
    OV: ov.level.index,
    OV_TOTAL_M1: ov.total - 1,
    BAND_LIST: bandList,
    NODATA: state.cogNoData !== null ? String(state.cogNoData) : 'None',
  };
}

function fill(tpl, subs) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    return (k in subs) ? String(subs[k]) : `{{${k}}}`;
  });
}

async function copyToClipboard() {
  const txt = document.getElementById('codegenOutput').textContent;
  try {
    await navigator.clipboard.writeText(txt);
    flashStatus('Copied');
  } catch (e) {
    // fallback for non-https origins (older browsers)
    const ta = document.createElement('textarea');
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); flashStatus('Copied'); }
    catch (e2) { flashStatus('Copy failed'); }
    document.body.removeChild(ta);
  }
}

function flashStatus(msg) {
  const btn = document.getElementById('codegenCopy');
  const old = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => { btn.textContent = old; }, 1200);
}
