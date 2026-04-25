// IFD / tags / GeoKeys / COG-friendliness inspector.

import { state, bus } from '../state.js';
import {
  summarizeOverviews, summarizeTags, summarizeGeoKeys,
  compressionName, photometricName, predictorName, cogFriendliness,
} from '../cog/ifd.js';

export function init() {
  const toggle = document.getElementById('ifdToggle');
  toggle.addEventListener('click', () => {
    document.getElementById('ifdContent').classList.toggle('open');
    toggle.textContent = document.getElementById('ifdContent').classList.contains('open')
      ? '▼ Inspect (IFDs / tags / GeoKeys)'
      : '▶ Inspect (IFDs / tags / GeoKeys)';
  });
  bus.on('header-loaded', render);
}

async function render() {
  if (!state.tiff) return;
  document.getElementById('ifdSection').classList.remove('hidden');

  const overviews = await summarizeOverviews();
  const friendly = cogFriendliness(overviews);

  let badge;
  if (friendly.ok) {
    badge = '<span class="badge ok">✅ Cloud-Optimized</span>';
  } else {
    const issues = friendly.checks.filter((c) => !c.ok).map((c) => c.label).join(', ');
    badge = `<span class="badge err">⚠ Not fully COG: ${issues}</span>`;
  }
  const checkRows = friendly.checks
    .map((c) => `<li><span class="${c.ok ? 'ok' : 'err'}">${c.ok ? '✓' : '✗'}</span> ${c.label} — <span class="muted">${c.detail}</span></li>`)
    .join('');

  let html = badge + `<ul class="check-list">${checkRows}</ul>`;

  // Overview ladder
  html += '<h4>Overview ladder</h4><table class="ifd-table"><thead><tr>' +
    '<th>#</th><th>Size</th><th>Tile</th><th>Compr.</th><th>Pred.</th><th>Photom.</th><th>Bytes</th></tr></thead><tbody>';
  for (const ov of overviews) {
    const tile = (ov.tileWidth && ov.tileHeight) ? `${ov.tileWidth}×${ov.tileHeight}` : 'striped';
    const bytes = ov.compressedBytes ? formatBytes(ov.compressedBytes) : '?';
    html += `<tr>
      <td>${ov.index}</td>
      <td>${ov.width}×${ov.height}</td>
      <td>${tile}</td>
      <td>${compressionName(ov.compression)}</td>
      <td>${ov.predictor ? predictorName(ov.predictor) : '—'}</td>
      <td>${ov.photometric != null ? photometricName(ov.photometric) : '—'}</td>
      <td>${bytes}</td>
    </tr>`;
  }
  html += '</tbody></table>';

  // GeoKeys
  const geoKeys = summarizeGeoKeys(state.mainImage);
  if (geoKeys.length) {
    html += '<h4>GeoKeys (main image)</h4><dl class="kv-list">';
    for (const { name, value } of geoKeys) html += `<dt>${name}</dt><dd>${value}</dd>`;
    html += '</dl>';
  }

  // Tags
  const tags = summarizeTags(state.mainImage);
  if (tags.length) {
    html += '<h4>TIFF tags (main image)</h4><dl class="kv-list">';
    for (const { name, value } of tags) html += `<dt>${name}</dt><dd>${escapeHtml(value)}</dd>`;
    html += '</dl>';
  }

  document.getElementById('ifdContent').innerHTML = html;
}

function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
