# Roadmap

What's next, in roughly the order of expected work. Everything here is
provisional — the project is small, priorities shift cheaply.

For the design rules these features must satisfy, see
[DESIGN.md](DESIGN.md).

## Next up

### CORS proxy via Cloudflare Pages Function

**Why**: many useful public datasets (Copernicus DEM, NASA EarthData
mirrors, parts of ESA Copernicus DataSpace) don't serve CORS headers, so
the browser refuses cross-origin requests. The viewer can't read them
directly.

**Plan**: a stateless `/proxy?url=...` Pages Function that forwards GET
+ Range requests with permissive CORS headers. SSRF-safe via host
allowlist (S3 public buckets, Planetary Computer, OpenStreetMap, etc.).
A "Route via CORS proxy" checkbox in the UI; permalink encodes it.

**Companion change**: a `dev-wrangler.sh` that runs
`wrangler pages dev .` so Functions work locally too.

Tracking task: in the working plan file
(`~/.claude/plans/cog-jupyter-projects-reearth-serve-mvp-fizzy-blum.md`).

### Curated catalog + STAC item parser

**Why**: opening the viewer with no URL is a dead end for someone new.
And typing a 200-character S3 URL by hand is friction.

**Plan**:

- `samples.json` — a hand-curated list of CORS-verified public COGs
  (DEM / optical / SAR), each with a `verifiedCors: true` flag.
- A "Browse samples" modal in the sidebar that lists them with one-click
  load.
- A "Paste STAC item URL" path that fetches a STAC item JSON and lists
  its assets — so any STAC-compliant catalog (Earth Search, Planetary
  Computer, etc.) just works.

## Wishlist (no immediate plans)

- **Microsoft Planetary Computer SAS signing.** Token-based but
  CORS-friendly; could be a thin client-side helper. Fold into the
  catalog feature if pursued.
- **A vs B compare / diff.** Load two COGs, side-by-side or split-screen
  swipe; diff layer when CRS+bbox+resolution match.
- **Histogram-driven manual stretch.** Drag handles on the histogram to
  set min/max instead of typing numbers.
- **Save/restore named views.** Beyond permalinks — give a view a name,
  store in localStorage.

## Won't fix / out of scope

See [DESIGN.md](DESIGN.md#what-we-say-no-to) for the full list. Examples:
login flows, time-series animation, 3D, embedded Jupyter, mobile-first.

## How to propose a feature

1. Open an issue describing the problem (not the solution).
2. Reference the [Decision protocol](DESIGN.md#decision-protocol) — does
   it pass all four checks?
3. If it does, propose an approach. Small static patches are most
   welcome.
