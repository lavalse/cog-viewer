// Tool switcher: info / profile / clip. Mutually exclusive; ESC cancels.

import { state, bus } from '../state.js';
import { map, sources } from './setup.js';
import { sampleAt, sampleRgbAt } from '../cog/readers.js';
import { startProfileDraw, closeProfile } from './profile.js';
import { startClipDraw, clearClipOverlay } from './clip.js';

let activeTool = null;
let toolInteraction = null;

export function setTool(name) {
  if (activeTool === name) { clearTool(); return; }
  clearTool();
  activeTool = name;
  document.querySelectorAll('.tool-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.tool === name);
  });
  const hint = document.getElementById('toolHint');
  if (name === 'info') {
    hint.classList.remove('visible');
    map.getViewport().style.cursor = 'crosshair';
  } else if (name === 'profile') {
    hint.textContent = 'Click start, click more points, double-click to finish (ESC to cancel)';
    hint.classList.add('visible');
    map.getViewport().style.cursor = 'crosshair';
    toolInteraction = startProfileDraw(() => {
      hint.classList.remove('visible');
      toolInteraction = null;
    });
  } else if (name === 'clip') {
    hint.textContent = 'Drag to select a region to download as GeoTIFF (ESC to cancel)';
    hint.classList.add('visible');
    map.getViewport().style.cursor = 'crosshair';
    toolInteraction = startClipDraw(() => {
      hint.classList.remove('visible');
      toolInteraction = null;
    });
  }
}

export function clearTool() {
  activeTool = null;
  document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
  document.getElementById('toolHint').classList.remove('visible');
  document.getElementById('mapTooltip').style.display = 'none';
  map.getViewport().style.cursor = '';
  if (toolInteraction) { map.removeInteraction(toolInteraction); toolInteraction = null; }
  sources.profile.clear();
  sources.clip.clear();
  clearClipOverlay();
}

export function showToolbar() { document.getElementById('toolbar').classList.add('visible'); }
export function hideToolbar() {
  document.getElementById('toolbar').classList.remove('visible');
  clearTool();
}

export function getActiveTool() { return activeTool; }

// Wire pointermove for the info tooltip.
export function installInfoHover() {
  map.on('pointermove', (evt) => {
    const tip = document.getElementById('mapTooltip');
    if (activeTool !== 'info' || !state.fetchedBands || !state.fetchedBbox) {
      tip.style.display = 'none';
      return;
    }
    const mp = map.getView().getProjection();
    const lonlat = ol.proj.toLonLat(evt.coordinate);
    let cc;
    try { cc = ol.proj.transform(evt.coordinate, mp, state.cogProj); }
    catch (e) { tip.style.display = 'none'; return; }
    tip.style.left = (evt.pixel[0] + 14) + 'px';
    tip.style.top = (evt.pixel[1] + 14) + 'px';
    tip.style.display = 'block';
    if (state.renderMode === 'rgb') {
      const rgb = sampleRgbAt(cc);
      if (!rgb) {
        tip.innerHTML = `NoData<br><span style="opacity:.7">${lonlat[0].toFixed(4)}°E, ${lonlat[1].toFixed(4)}°N</span>`;
      } else {
        tip.innerHTML = `<b>R ${fmt(rgb[0])} · G ${fmt(rgb[1])} · B ${fmt(rgb[2])}</b><br>` +
          `<span style="opacity:.7">${lonlat[0].toFixed(4)}°E, ${lonlat[1].toFixed(4)}°N</span>`;
      }
      document.getElementById('pixelInfo').textContent =
        `${lonlat[0].toFixed(6)}, ${lonlat[1].toFixed(6)} → ` +
        (rgb ? `R ${fmt(rgb[0])} G ${fmt(rgb[1])} B ${fmt(rgb[2])}` : 'NoData');
    } else {
      const v = sampleAt(cc);
      tip.innerHTML = (v === null ? 'NoData' : `<b>${v.toFixed(2)}</b>`) +
        `<br><span style="opacity:.7">${lonlat[0].toFixed(4)}°E, ${lonlat[1].toFixed(4)}°N</span>`;
      document.getElementById('pixelInfo').textContent =
        `${lonlat[0].toFixed(6)}, ${lonlat[1].toFixed(6)} → ` + (v === null ? 'NoData' : v.toFixed(2));
    }
  });
  map.getViewport().addEventListener('mouseleave', () => {
    document.getElementById('mapTooltip').style.display = 'none';
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeTool) clearTool();
  });
}

function fmt(v) {
  if (v == null || Number.isNaN(v)) return '?';
  if (Math.abs(v) >= 100) return v.toFixed(0);
  return v.toFixed(2);
}
