// fetch monkey-patch to count bytes/requests against COG endpoints.
// Updates the #netBar element directly.

import { state, bus } from './state.js';

const origFetch = window.fetch;

export function installNetCounter() {
  window.fetch = function () {
    const url = (typeof arguments[0] === 'string') ? arguments[0] : '';
    return origFetch.apply(this, arguments).then((r) => {
      if (url.indexOf('/files/') !== -1 || url.indexOf('.tif') !== -1) {
        state.netBytes += parseInt(r.headers.get('Content-Length') || '0', 10);
        state.netReqs++;
        bus.emit('net-update');
      }
      return r;
    });
  };
}

export function rawFetch() {
  return origFetch.apply(this, arguments);
}

export function resetNetCounter() {
  state.netBytes = 0;
  state.netReqs = 0;
  bus.emit('net-update');
}

export function renderNetBar(el) {
  if (state.netBytes === 0 && state.netReqs === 0) {
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  const pct = state.fileSize > 0 ? (state.netBytes / state.fileSize * 100).toFixed(1) : '?';
  let html = `Downloaded: <b>${(state.netBytes / 1024).toFixed(0)} KB</b> in ${state.netReqs} req`;
  if (state.fileSize > 0) {
    html += ` — <b>${pct}%</b> of ${(state.fileSize / 1024 / 1024).toFixed(1)} MB`;
  }
  if (state.lastOverview) {
    const u = state.mainImage && state.mainImage.getGeoKeys().ProjLinearUnitsGeoKey === 9001 ? 'm' : 'u';
    const lvl = state.lastOverview.level;
    html += `<br>Overview: <b>level ${lvl.index} / ${state.lastOverview.total - 1}</b>` +
      ` (${lvl.resX.toFixed(2)} ${u}/px) — ground res: ${state.lastOverview.groundRes.toFixed(2)} ${u}/px`;
  }
  el.innerHTML = html;
}
