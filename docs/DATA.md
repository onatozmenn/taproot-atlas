# Data — taproot-atlas

All datasets are versioned snapshots under `data/`. Re-ingests ship a new
`snapshotVersion` / `sourceVersionId`; history is never rewritten.

| File | Provider | Report period | Capture time | License |
| ---- | -------- | ------------- | ------------ | ------- |
| `epa-service-area.json` | EPA Service Area Boundaries (simplified showcase extract) + NYC DEP watershed geography | n/a (boundary snapshot) | 2026-01-02 | US public data; polygons here are schematic, not legal definitions |
| `echo-nyc.json` | EPA ECHO / SDWIS (recorded fixture, ECHO response shape) | 2021-01-01 → 2026-01-01 | 2026-01-02 | US public data; verify live at https://echo.epa.gov/ |
| `nyc-2025.json` | NYC DEP Annual Drinking Water Supply and Quality Report (curated extract) | 2025 Annual | 2026-01-02 | NYC public data; source doc linked per metric |

## Boundary confidence

- NYC showcase system → `verified_agency`.
- Coordinates outside every snapshot polygon → `unverified_fallback` (see `lib/geo.ts`).
- OSM `amenity=drinking_water` points → always `unverified_fallback`, never a Verified badge.

## Going live

- ECHO: point `fetchEchoCompliance` at the ECHO web-services endpoint returning the
  `echo-nyc.json` shape (same `pwsid` / `records` contract).
- NYC: extend `nyc-2025.json` with the full published table, bump to `nyc-20XX-vN`.
- OSM: `lib/osm.ts` already queries the public Overpass API; respect its usage policy.
