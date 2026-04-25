// Band selection + RGB compose + palette + stretch controls.
// Re-renders by re-calling fetch (simpler than re-painting the same bands when palette changes,
// but cheap because data is already on overview level — most "render" changes won't trigger network).

import { state, bus } from '../state.js';
import { paletteNames, palettePreview } from '../render/palette.js';
import { update as updatePermalink } from '../util/permalink.js';

let renderRequest = null;

export function init() {
  bus.on('header-loaded', renderControls);
  bus.on('fetched', renderControls);
  document.getElementById('paletteSel').addEventListener('change', (e) => {
    state.palette = e.target.value;
    triggerRerender();
    updatePermalink();
  });
  document.getElementById('stretchSel').addEventListener('change', (e) => {
    state.stretch = { mode: e.target.value, min: state.stretch.min, max: state.stretch.max };
    triggerRerender();
    updatePermalink();
  });
}

function renderControls() {
  if (!state.mainImage) return;
  const wrap = document.getElementById('bandControls');
  wrap.classList.remove('hidden');
  const N = state.samplesPerPixel;

  const modeRow = document.getElementById('renderModeRow');
  if (N >= 3) {
    modeRow.classList.remove('hidden');
    document.querySelectorAll('input[name=renderMode]').forEach((r) => {
      r.checked = (r.value === state.renderMode);
      r.onchange = () => {
        state.renderMode = r.value;
        renderBandPickers();
        triggerRerender();
        updatePermalink();
      };
    });
  } else {
    modeRow.classList.add('hidden');
    state.renderMode = 'single';
  }

  renderBandPickers();
  populatePalette();
  document.getElementById('stretchSel').value = state.stretch.mode;
}

function renderBandPickers() {
  const N = state.samplesPerPixel;
  const single = document.getElementById('bandSingleRow');
  const rgb = document.getElementById('bandRgbRow');
  if (state.renderMode === 'rgb' && N >= 3) {
    single.classList.add('hidden');
    rgb.classList.remove('hidden');
    fillSelect('bandRSel', N, state.bandPick.r, (v) => { state.bandPick.r = v; triggerRefetch(); });
    fillSelect('bandGSel', N, state.bandPick.g, (v) => { state.bandPick.g = v; triggerRefetch(); });
    fillSelect('bandBSel', N, state.bandPick.b, (v) => { state.bandPick.b = v; triggerRefetch(); });
    document.getElementById('paletteRow').classList.add('hidden');
  } else {
    single.classList.remove('hidden');
    rgb.classList.add('hidden');
    document.getElementById('paletteRow').classList.remove('hidden');
    fillSelect('bandSingleSel', N, state.bandPick.single, (v) => {
      state.bandPick.single = v; triggerRefetch();
    });
  }
}

function fillSelect(id, N, current, onChange) {
  const sel = document.getElementById(id);
  sel.innerHTML = '';
  for (let i = 0; i < N; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = 'Band ' + (i + 1);
    if (i === current) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.onchange = () => { onChange(parseInt(sel.value, 10)); updatePermalink(); };
}

function populatePalette() {
  const sel = document.getElementById('paletteSel');
  if (sel.options.length === 0) {
    for (const n of paletteNames()) {
      const opt = document.createElement('option');
      opt.value = n; opt.textContent = n;
      sel.appendChild(opt);
    }
  }
  sel.value = state.palette;
  const sw = document.getElementById('paletteSwatch');
  sw.style.backgroundImage = `url(${palettePreview(state.palette)})`;
}

// "Refetch" actually rereads pixels (because band selection changes which samples are read).
function triggerRefetch() {
  if (!state.fetchedBands) return;
  // Defer to bus event handled by selection.js → fetchSelected
  bus.emit('refetch-requested');
}

// "Rerender" only repaints from existing band data (palette / stretch change).
function triggerRerender() {
  if (renderRequest) cancelAnimationFrame(renderRequest);
  renderRequest = requestAnimationFrame(() => {
    renderRequest = null;
    bus.emit('rerender-requested');
  });
}
