# Taproot Atlas data layer

Every number in an answer comes from an official, versioned snapshot below.
Runtime never invents values; derived fields are arithmetic over these files.

| Layer | Source | Coverage | Build script |
|---|---|---|---|
| System profiles (system, areas served, sources, plants, purchased-water chain, lead & copper 90th percentiles, violations + enforcement, sanitary surveys) | EPA ECHO SDWA bulk download (SDWIS federal data, quarterly) | All ~9,700 active US community water systems serving 3,300+ people (~93% of the population on community systems) | `scripts/build-sdwis-profiles.py --shard --treatment treatment_all.csv SDWA_latest_downloads.zip pwsids.txt data/national` |
| Treatment processes | EPA Envirofacts `TREATMENT` table (paged bulk CSV) | same | (input to the script above) |
| Lab results, 2012-2019 (metals, nitrate, arsenic, fluoride, TTHM/HAA5, disinfectant residuals, radionuclides, VOCs, pesticides) | EPA Six-Year Review 4 compliance monitoring | same, where the state reported | `scripts/build-occurrence.py --shard <raw-dir> pwsids.txt data/national` |
| PFAS (29 compounds) + lithium, 2023-2025 | EPA UCMR 5 occurrence data | all systems sampled under UCMR 5 | (same script) |
| Places, ZIP centroids | US Census 2024 Gazetteer | all US places and ZCTAs | `scripts/build-places.py` |
| Federal limits | 40 CFR 141 MCLs, action levels, MRDLs; 2024 PFAS NPDWR | n/a | `lib/standards.ts` |

Rules baked into `lib/profile.ts`:

- A single sample above an MCL value is **not** a violation (compliance is averaged); the UI and answers say so.
- Values more than 20x a federal limit are treated as unit-entry errors and excluded from max/counts (and disclosed).
- Non-detects are counted, never imputed.
- PFAS limits follow the April 2024 rule (in force); the May 2026 proposal to rescind PFHxS/PFNA/GenX limits and extend PFOA/PFOS compliance to 2031 is noted wherever limits appear.

Shards: `data/national/<ST>.json.gz` (profiles), `<ST>.occ.json.gz` (lab), `index.json`, `places.json`. They are read with `fs` by the `/api/ask` function (`vercel.json` `includeFiles`), never shipped to the browser.

Refresh: re-download the ECHO SDWA zip quarterly and rerun the two build scripts.

## Service-area polygons (`data/national/<ST>.geo.json.gz`)

EPA Public Water System Service Areas, v3 (March 2026), queried by PWSID from the
hosted layer `services.arcgis.com/cJ9YHowT8TU7DUyn/.../Water_System_Boundaries/FeatureServer/0`
with `maxAllowableOffset=0.002` (about 200 m) and 4-decimal coordinates. 9,498 of
9,675 profiled systems have a polygon. `m` is `reported` (state or utility
boundary) or `modeled` (EPA random-forest / decision-tree estimate); the map draws
modeled borders dashed and says so.
