// File drag-drop onto viewport → loadHeaderFromBlob.

import { loadHeaderFromBlob } from '../cog/load.js';

export function installDropZone(target, onLoaded) {
  ['dragenter', 'dragover'].forEach((evt) => {
    target.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      target.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    target.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      target.classList.remove('drag-over');
    });
  });
  target.addEventListener('drop', async (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    if (!/\.(tif|tiff|cog)$/i.test(f.name)) {
      alert('Drop a .tif / .tiff file');
      return;
    }
    try {
      await loadHeaderFromBlob(f, f.name);
      if (onLoaded) onLoaded(f);
    } catch (err) {
      console.error(err);
      alert('Failed to read file: ' + err.message);
    }
  });
}
