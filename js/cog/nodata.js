// NoData detection: declared GDAL_NODATA + well-known sentinels + Japan convention.
// Pure function — no state imports — so it can be reused by codegen too.

export function isNoData(v, declared) {
  if (v === null || v === undefined || Number.isNaN(v)) return true;
  if (v >= 1e30 || v <= -1e30) return true;
  if (declared !== null && declared !== undefined && v === declared) return true;
  if (v === -9999 || v === -32768 || v === 32767) return true;
  return false;
}

// Bound-state convenience used inside the app.
import { state } from '../state.js';
export function isNoDataS(v) { return isNoData(v, state.cogNoData); }
