# Data — taproot-atlas

All datasets are versioned snapshots under `data/`. Re-ingests ship a new
`snapshotVersion` / `sourceVersionId`; history is never rewritten.

| File | Provider | Report period | Capture time | License |
| ---- | -------- | ------------- | ------------ | ------- |
| `epa-service-area.json` | Coarse modeled extent approximating the five NYC boroughs, derived from EPA Service Area Boundary geography | n/a (boundary snapshot) | 2026-01-02 | US public data; schematic only — never `verified_agency`, never a legal definition |
| `us-boundaries.json` | EPA national service-area rings for the 100 directory systems (FeatureServer, precision 3 + simplified; 100/100 matched). `Verification_Status=Verified` → `verified_agency`, else `modeled_epa`. Rebuild: `python scripts/pull-us-boundaries.py` | n/a (boundary snapshot) | per pull | EPA public data; coarse orientation rings, never a legal definition |
| `echo-nyc.json` | **Demonstration fixture** in ECHO SDWIS record shape for NY7003493 (NOT a captured EPA response) | 2021-01-01 → 2026-01-01 | 2026-01-02 | Fixture; verify live records at the `sourceQueryUrl` inside the file |
| `nyc-2024.json` | NYC DEP Annual Drinking Water Supply and Quality Report, curated extract (2024 report) | 2024 Annual | 2026-01-02 | NYC public data; source doc linked per metric |
| `chi-2025.json` | City of Chicago 2025 Water Quality Report, curated extract (coliform + turbidity; lead omitted — ambiguous table extraction) | 2025 Annual | 2026-10-06 | Chicago public data; testDate uses report-year-end granularity, documented in-file |
| `treatment-nyc.json` | Reported SDWIS TREATMENT processes for NY7003493 via Envirofacts efservice (verified 2026-10-06) | n/a (treatment snapshot) | 2026-10-06 | EPA public data; plain-English process phrases only |
| `facility-nyc.json` | SDWIS WATER_SYSTEM_FACILITY extract shape for NY7003493 (intake/reservoir + seller chain; no coordinates, never stored) | n/a (facility snapshot) | 2026-10-07 | EPA public data via efservice; live at `/efservice/WATER_SYSTEM_FACILITY/PWSID/{pwsid}/JSON` |
| `lcr-nyc.json` | LCR 90th-percentile placeholder for NY7003493 (empty until live pull or vendor) | LCR monitoring | 2026-10-07 | EPA SDWIS via efservice; live at `/efservice/LCR_SAMPLE_RESULT/PWSID/{pwsid}/JSON` |
| `ucmr5-nyc.json` | UCMR5 occurrence placeholder (29 PFAS + lithium, 2023-2025; empty until `pull-ucmr5.py`) | UCMR5 2023-2025 | 2026-10-07 | EPA UCMR occurrence data; occurrence is not an MCL violation |
| `ucmr5.json` | Top-10 PWSID-filtered UCMR5 occurrence extract (7/10 with detects >=MRL, 3/10 with no detects; max 6/system, NPDWR PFAS first). Rebuild: `python scripts/pull-ucmr5-top10.py` | UCMR5 2023-2025 | 2026-10-07 | EPA UCMR occurrence text files by state; units normalized to ug/L (source ships micro sign stripped); occurrence is not MCL compliance |
| `syr4-nyc.json` | SYR4 placeholder (2012-2019 compliance monitoring; empty until `pull-syr4.py`) | SYR4 2012-2019 | 2026-10-07 | EPA Six-Year Review 4 data |
| `distribution-nyc.json` | NYC distribution-monitoring placeholder (Socrata `bkwf-xfky`; empty until live pull) | Distribution monitoring | 2026-10-07 | NYC open data; live `https://data.cityofnewyork.us/resource/bkwf-xfky.json` |
| `conveyances.json` | Vendored large conveyances (Catskill/Delaware Aqueduct, schematic only) | n/a | 2026-10-07 | Utility pages + OSM tags; schematic, never engineering |
| `water-use.json` | USGS modeled SW/GW split placeholder (2000-2020 HUC12; empty until vendor) | 2000-2020 | 2026-10-07 | USGS ScienceBase; modeled, never a meter reading |
| `us-systems.json` | Top-100 US community water systems by population served, from EPA SDWIS (Envirofacts efservice WATER_SYSTEM: active CWS serving >100k, largest per city). Map centers geocoded via OSM Nominatim. Rebuild: `python scripts/pull-us-systems.py` | 2021-01-01 → 2026-01-01 (compliance window) | capture per pull | EPA SDWIS (PWSID/city/pop) + OSM (centers); 39 curated entries ship basins and utility links (see `verificationSources` in-file) |

## Boundary confidence

- National EPA rings (`us-boundaries.json`, 100/100 directory systems) →
  `verified_agency` when the EPA `Verification_Status` is Verified, else
  `modeled_epa`. Bundled borough extent likewise → `modeled_epa`.
  `verified_agency` is reachable by coordinate; name-only matches stay
  `unverified_fallback` (location unproven).
- Directory cities split into two tiers:
  - **Tier A (39 systems)** — verified basins + utility links from official
    utility pages (NYC, LA, Chicago, Houston, San Antonio, Boston/MWRA, Miami,
    WSSC, Baltimore, Philadelphia, Las Vegas, EBMUD, San Diego, Dallas,
    Cleveland, Columbus, Denver, Charlotte, Seattle, Austin, Atlanta,
    San Jose, Fairfax/Herndon, Suffolk/Hauppauge, Gwinnett/Lawrenceville,
    Fort Worth, Indianapolis, Burlingame, Jacksonville, Louisville,
    Aqua PA/Bryn Mawr, Cincinnati, El Paso, Tampa, Cobb/Marietta,
    Pittsburgh, Veolia Hackensack, Boston BWSC, West Palm Beach); NYC
    additionally ships lab metrics + compliance snapshot.
  - **Tier B (61 systems)** — verified PWSID + city + map center only; no
    basins, no metrics, `snapshotPending` compliance. Narratives say so
    plainly instead of claiming coverage.
  Both tiers resolve by city-name match (a name mention beats the default
  coordinates) with honest `unverified_fallback` boundaries until agency
  polygons ship.
- Coordinates outside every snapshot polygon and directory match →
  `unverified_fallback` (see `lib/geo.ts` + `lib/systems.ts`).
- OSM `amenity=drinking_water` points → always `unverified_fallback`, never a Verified badge.

## Going live (ECHO + SDWIS + NLDI adapters)

Live SDWIS compliance is served by `lib/echo-live.ts` against the public
Envirofacts efservice `VIOLATION` table (no key; verified 2026-10-05):
`VIOLATION/PWSID/=/{pwsid}/rows` → window overlap on
`compl_per_begin/end_date` → `SdwisViolationRecord[]`
(`health_based` iff `is_health_based_ind=Y`, `monitoring_and_reporting` iff
category `MR`, otherwise `other`; `complianceAchieved` iff `rtc_date` set).
Absence of rows in the window is a real finding, served with
`recordSource: live_fetch`. The UI tiers `other` separately from
`monitoring-only` so non-MR categories are never mislabeled.

Enable with `ECHO_LIVE_SOURCE=efservice` (server only). Anything else keeps
the bundled snapshot so previews and tests stay hermetic. Any live failure
degrades inside the pipeline — NYC to its snapshot, other systems to
`snapshotPending` — and relabels `recordSource` to `snapshot_fixture`;
a failed fetch never 502s. Live lookup runs for every known PWSID (NYC plus
all directory cities); only UNKNOWN areas stay pending by definition.

The older ECHO web-services search endpoints remain documented in git history
for PWSID discovery; the snapshot fixture contract (`EchoSnapshotShape`) is
unchanged.

## New live adapters (all fail-soft, 8s, hermetic default)

- `lib/facility.ts`: `WATER_SYSTEM_FACILITY/PWSID` → intake/well/reservoir/
  treatment rows + `seller_pwsid` chain (depth-capped at 4, max 8 facilities).
  Fixture `data/facility-nyc.json`. Intake coordinates are never published;
  routes stay schematic.
- `lib/lcr.ts`: `LCR_SAMPLE_RESULT/PWSID` → Lead/Copper 90th percentiles
  against action levels. Fixture `data/lcr-nyc.json` (empty placeholder).
- `lib/distribution.ts`: NYC Socrata `bkwf-xfky` → chlorine/turbidity/
  coliform/E. coli distribution rows (NYC only, max 4).
- `lib/nldi.ts`: `https://api.water.usgs.gov/nldi` (never the retired
  `labs.waterdata` host; never NWIS WaterServices, closing Nov 2026-Feb 2027)
  → upstream flowline count + WQP station count + characteristic names.
  Pre-treatment context only, schematic confidence, no geometry in text.
- `lib/occurrence.ts`: build-time snapshots only (`data/ucmr5-nyc.json`,
  `data/syr4-nyc.json`, `data/distribution-nyc.json`). Large zips are vendored
  by `scripts/pull-ucmr5.py`, `scripts/pull-syr4.py`, `scripts/pull-ca-ddw.py`,
  `scripts/pull-echo-bulk.py` into PWSID-filtered JSON (max 6 rows each).
  UCMR rows render with the occurrence disclaimer, never as MCL violations.
- `lib/water-use.ts` + `lib/conveyance.ts`: snapshot-only modeled/schematic
  context (`data/water-use.json`, `data/conveyances.json`).

Enable all live paths with `ECHO_LIVE_SOURCE=efservice` (server only).
Without it the pipeline serves fixtures + empty honest pendings so previews
and tests stay hermetic. Every live failure degrades inside the pipeline and
never 502s.
