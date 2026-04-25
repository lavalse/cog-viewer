# CLAUDE.md

Guidance for Claude Code (and other AI agents) working on this project.
For the user-facing description, see [README.md](README.md). For why we
made the design choices we did, see [DESIGN.md](DESIGN.md).

## Run / dev / deploy

```bash
./dev.sh                    # local dev server (python3 http.server, port 5503, binds 0.0.0.0)
./dev.sh 8080               # custom port
```

Production deploy (Cloudflare Pages):

```bash
wrangler pages deploy . --project-name=cog-viewer --branch=main --commit-dirty=true
```

Live: https://cog-viewer.pages.dev — repo: https://github.com/lavalse/cog-viewer

## Architecture in 30 seconds

Vanilla ES modules. No build step. CDN libraries (OpenLayers, geotiff.js,
proj4) are loaded as globals from `<script>` tags; project code is in
`<script type="module">`.

State lives in a single mutable singleton + a tiny pub/sub bus, both in
`js/state.js`. Modules **do not** import each other's internals — they
import `{ state, bus }` and subscribe to events:

| Event | When |
|---|---|
| `header-loaded` | Step 1 finished (URL or local file parsed) |
| `selection-changed` | Step 2 bbox changed |
| `fetched` | Step 2 pixel data arrived |
| `refetch-requested` | Band selection changed → need new pixels |
| `rerender-requested` | Palette/stretch changed → repaint from existing pixels |
| `net-update` | Network counter ticked |

## File map

```
js/
  state.js          state singleton + bus
  crs.js            Japanese plane-rectangular CRS registration
  net.js            fetch monkey-patch + network panel
  cog/              parsing & data fetching
    load.js         URL or Blob → header
    overview.js     selectOverview, window math (load-bearing)
    nodata.js       sentinel detection (pure)
    ifd.js          tag/IFD/GeoKey extraction
    readers.js      single-band / RGB pixel reads + sample helpers
  render/           pixel data → canvas
    palette.js      named color ramps
    stretch.js      auto / p2-98 / manual
    single.js       single-band paint
    rgb.js          3-band compose
  map/              OpenLayers integration
    setup.js        map + vector sources
    draw.js         bbox draw
    tools.js        info/profile/clip switcher + hover
    profile.js      profile chart (single-band line + RGB triple)
    clip.js         sub-bbox + writeArrayBuffer download
  panels/           sidebar UI (one file per concern)
    datasource.js   Step 1
    selection.js    Step 2 + render orchestration
    analysis.js     Step 3
    bandcontrols.js band/RGB/palette/stretch UI
    ifdinspector.js IFD/tag inspector
    codegen.js      Copy-as-Python
  util/
    permalink.js    URL-hash encode/decode
    dragdrop.js     file drop zone
  main.js           bootstrap
```

## Load-bearing functions (don't break casually)

- **`selectOverview()`** at `js/cog/overview.js` — coarsest-overview pick.
  The whole COG-aware story rests on this. If a 256×256 preview of a 2 GB
  DEM ends up downloading 50 MB, this is where to look.
- **`bboxToWindowForImage()`** same file — derives the overview's effective
  resolution from `mainBbox` + the overview's pixel dimensions. Overviews
  don't carry their own geotransform; calling `image.getResolution()` on
  one throws.
- **`isNoData(v, declared)`** at `js/cog/nodata.js` — pure function. Used
  by readers, render, analysis, profile, clip. Add detection here before
  adding it elsewhere.
- **`fetch` monkey-patch** at `js/net.js` — counts bytes for COG-shaped
  URLs. Don't bypass `window.fetch` from inside the viewer; if you do,
  the network panel will under-report.

## Code conventions

- 2-space indent, single quotes, semicolons.
- ES modules; one default `export` per file is fine but named exports are
  preferred when there's more than one symbol.
- Comments explain *why*, not *what*. Don't write multi-paragraph
  docstrings on a function that does one obvious thing.
- Add a new module before bloating an existing one. Modules are cheap.
- Don't break the no-build invariant. CDN libraries are fine; npm packages
  that require a bundler are not.
- Don't reach into `state.tiff.fileDirectories[0]` from a panel. Pull the
  data through `js/cog/ifd.js` (or add to it).

## Pitfalls (these have all bitten us)

1. **`readRasters({ bbox })` loads the whole image.** It crops in JS
   afterward. Use `readRasters({ window: [x0,y0,x1,y1] })` with pixel
   coordinates instead — that's what triggers per-tile Range requests.
2. **WebGLTile + Float32 = white screen.** OpenLayers' WebGLTile clamps
   Float32 to 0-255. We render manually via Canvas 2D → ImageStatic.
3. **CORS varies by S3 bucket.** `sentinel-cogs` has it; `copernicus-dem-30m`
   doesn't. There's no client-side way to auto-detect. The eventual
   Pages-Function proxy (see ROADMAP) is the planned fix.
4. **NoData round outliers.** If Min/Max looks like `-9999`, `-32768`, or
   `1.7e38`, a sentinel slipped through `isNoData`. Add the value there,
   not in the calling code.
5. **Pixel-art logo scaling.** All derivatives use
   `Image.Resampling.NEAREST`. Display elements use
   `image-rendering: pixelated; image-rendering: crisp-edges`.
6. **`evt.pixel` is map-relative, not viewport-relative.** Tooltip
   positioning bases on `map.getSize()`. Otherwise the tooltip overflows
   the viewport and triggers a page-level scrollbar.

## Things deliberately *not* here

If a request would add one of these, push back before implementing:

- A build step (webpack / vite / rollup) — kills "clone and run".
- A backend other than the optional CORS-proxy Pages Function.
- A frontend framework (React / Vue / Svelte) — too much weight for the
  size of the app.
- TypeScript — same reason; types in JSDoc comments are fine.
- Login flows / OAuth — public datasets only.
- 3D, time series animation, mobile-first responsive — wrong tool.
- Unit test framework (Vitest etc.). The pure helpers
  (`selectOverview`, `bboxToWindowForImage`, `isNoData`) might earn unit
  tests if they ever need a rewrite. Until then, smoke-test via the
  catalog (planned) or the Sentinel-2 sample URLs in the README.

## Auto-mode etiquette

When the user is running in auto mode:

- Small UI fixes, doc updates, and one-line bug fixes: just do them and
  push.
- Adding dependencies, changing the deploy pipeline, force-pushing,
  rewriting the auth surface: confirm first, even in auto mode.
- Commits use the project style: imperative subject, blank line, body
  that explains *why* the change exists. Always include the
  `Co-Authored-By: Claude` trailer.
- After a code change that affects the live site, run
  `wrangler pages deploy ...` so the user can test the deployed version.
  No need to ask each time.

## Working plans

The current detailed plan lives at
`~/.claude/plans/cog-jupyter-projects-reearth-serve-mvp-fizzy-blum.md`
and is rewritten per major task. The public-facing version is
[ROADMAP.md](ROADMAP.md).
