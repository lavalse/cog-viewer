# Design Philosophy

This document captures the *why* behind COG Viewer. It exists so feature
requests can be evaluated against the project's intent instead of added by
default.

## What this is

A **quick-look tool** for Cloud Optimized GeoTIFFs. You drop a URL, see
a region in seconds, decide whether it's the data you wanted. If yes,
you copy a Python snippet and continue in Jupyter for real work.

It is **not** a GIS application, **not** a publication-quality renderer,
and **not** a replacement for `rasterio` / QGIS / Earth Engine.

## Principles

### 1. COG-aware or it's nothing

The whole point of a Cloud Optimized GeoTIFF is partial reads. A viewer
that grabs the whole file to render a thumbnail defeats the format.

The viewer must:

- Probe the header in a single Range request (~16 KB)
- Pick the **coarsest** overview that still satisfies the screen's pixel
  density (not always the finest available)
- Issue tile-aligned Range requests, not whole-file fetches

These constraints aren't optional. The Network panel exists so the user
can verify them: if you select a huge bbox at 256×256 and the panel says
"Overview: level 0" (full resolution), something is broken.

### 2. Bridge to Jupyter, don't replace it

Copy-as-Python is a first-class feature, not a nice-to-have. The handoff
must be frictionless: same URL, same bbox, same overview level — paste
into a notebook cell and run.

The viewer is for **deciding**; Jupyter is for **doing**. We don't try
to host the doing.

### 3. Be honest about what doesn't work

The COG spec exists; CORS configuration practice doesn't always follow.
Many useful public datasets aren't browser-reachable. The viewer says so
explicitly:

- The Inspect panel flags non-tiled / non-overview files with a red badge
- The README has a "Sources without CORS" section
- Error messages name the actual problem (whitespace in URL, NoData
  sentinel leaking, CORS denial)

We never pretend a thing works when we know it doesn't.

### 4. Static-first, no infrastructure

`git clone && ./dev.sh` must always work. ES modules are fine; bundlers
are not. The optional CORS proxy lives in a Cloudflare Pages Function —
stateless, free-tier, and the viewer functions without it (URLs that
need it just opt in via a checkbox).

The result: trivially forkable, deployable in 30 seconds, auditable in
an afternoon.

### 5. Density over decoration

The sidebar is dense by design. CRS, band count, dtype, NoData, file
size, overview ladder, and download progress all sit on one scroll —
because a user inspecting an unfamiliar COG needs all of that, not three
of them with extra animation.

UI flourishes are deferred or rejected. The pixel-art frog mascot is the
project's only concession to vibe.

## What we say no to

These have come up; this is why they're not happening.

| Request | Why no |
|---|---|
| Login-protected sources (NASA EarthData, Copernicus DataSpace) | Out of scope; use `rasterio` + tokens. The viewer is for public data quick-look. |
| Time-series animation | One scene per session. For animation, use Earth Engine. |
| 3D terrain rendering | Cesium exists. |
| Embedded Jupyter (JupyterLite) | Adds 50+ MB of WASM. We hand off; we don't embed. |
| User accounts / saved workspaces | Permalinks are the entire state mechanism. |
| Mobile-first responsive design | Designed for laptop/desktop. Phones can view via LAN URL but aren't the target. |
| Adding a frontend framework | The whole app is small enough that a framework would be more code than the app. |

## Decision protocol

When deciding whether to add a feature, ask in order:

1. **Does it serve quick-look-then-handoff?** If the feature lives in
   Jupyter just as well, it doesn't belong here.
2. **Does it stay COG-aware?** If implementing it requires reading more
   bytes than the principle allows, redesign or reject.
3. **Does it preserve the no-build invariant?** If yes, proceed. If no,
   stop and re-examine.
4. **Does it add UI density that justifies its space?** A panel taking
   sidebar room must answer a question the user actually has at this
   step in the flow.

If a feature passes all four, build it. If it fails any, the burden of
proof is on the proposer.
