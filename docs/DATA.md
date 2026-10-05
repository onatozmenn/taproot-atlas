# Data — taproot-atlas

All datasets are versioned snapshots under `data/`. Re-ingests ship a new
`snapshotVersion` / `sourceVersionId`; history is never rewritten.

| File | Provider | Report period | Capture time | License |
| ---- | -------- | ------------- | ------------ | ------- |
| `epa-service-area.json` | Coarse modeled extent approximating the five NYC boroughs, derived from EPA Service Area Boundary geography | n/a (boundary snapshot) | 2026-01-02 | US public data; schematic only — never `verified_agency`, never a legal definition |
| `echo-nyc.json` | **Demonstration fixture** in ECHO SDWIS record shape for NY7003493 (NOT a captured EPA response) | 2021-01-01 → 2026-01-01 | 2026-01-02 | Fixture; verify live records at the `sourceQueryUrl` inside the file |
| `nyc-2024.json` | NYC DEP Annual Drinking Water Supply and Quality Report, curated extract (2024 report) | 2024 Annual | 2026-01-02 | NYC public data; source doc linked per metric |
| `us-systems.json` | Top-100 US community water systems by population served, from EPA SDWIS (Envirofacts efservice WATER_SYSTEM: active CWS serving >100k, largest per city). Map centers geocoded via OSM Nominatim. Rebuild: `python scripts/pull-us-systems.py` | 2021-01-01 → 2026-01-01 (compliance window) | capture per pull | EPA SDWIS (PWSID/city/pop) + OSM (centers); only the 4 curated entries ship verified basins and utility links (see `verificationSources` in-file) |

## Boundary confidence

- Bundled borough extent → `modeled_epa`. `verified_agency` is reserved for
  agency-published polygons (not yet vendored).
- Directory cities split into two tiers:
  - **Tier A (4 systems: NYC, LA, Chicago, Houston)** — verified basins +
    utility links; NYC additionally ships lab metrics + compliance snapshot.
  - **Tier B (96 systems)** — verified PWSID + city + map center only; no
    basins, no metrics, `snapshotPending` compliance. Narratives say so
    plainly instead of claiming coverage.
  Both tiers resolve by city-name match (a name mention beats the default
  coordinates) with honest `unverified_fallback` boundaries until agency
  polygons ship.
- Coordinates outside every snapshot polygon and directory match →
  `unverified_fallback` (see `lib/geo.ts` + `lib/systems.ts`).
- OSM `amenity=drinking_water` points → always `unverified_fallback`, never a Verified badge.

## Going live (ECHO adapter)

Live ECHO integration points (verified):
- Drinking Water System Search REST: https://echo.epa.gov/tools/web-services/facility-search-drinking-water
- Detailed Facility Report REST: https://echo.epa.gov/tools/web-services/detailed-facility-report
- Human verification for the showcase system: https://echo.epa.gov/detailed-facility-report?fid=NY7003493

`fetchEchoCompliance` expects the `EchoSnapshotShape` contract
(`pwsid`, `queryWindow`, integer `totalViolationsFound`, `records[]`); map the
chosen ECHO endpoint's fields onto it in one adapter function, then pass its URL
as `sourceUrl`. Until then, `readSnapshotCompliance` serves the bundled fixture
and every consumer must render the fixture label (see `recordSource`).
