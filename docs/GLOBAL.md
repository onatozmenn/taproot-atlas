# Taproot beyond the U.S. (`/#/global`, `lib/global.ts`)

**Why:** 2.1 billion people lacked safely managed drinking water in 2024 (WHO/UNICEF JMP 2025). Of 105 countries in UN-Water GLAAS 2025, 43% (urban) / 38% (rural) report regulators that publish public drinking-water quality reports, and 21% / 12% run surveillance at 95–100% of the required frequency. Taproot's method needs only three records a regulator already keeps: a system registry, test failures against health limits, and regulator actions.

**Open Water Record** (`lib/global.ts`): `{country, systemId, name, region, population, source?, exceedances[], actions[]}` with `validateRecord()`. Each country plugs in through an adapter.

**Readiness (sources opened 2026-10-09):**
| Place | Status | What is public |
|---|---|---|
| United States | live | SDWIS registry, violations, site visits, enforcement (EPA ECHO) |
| Ireland | data ready | 2025 monitoring results for all supplies (EPA SAFER-Data, open, CAPTCHA download, 21 MB xlsx); Remedial Action List (35 supplies, ~467,000 people, end-2025); 197 inspections in 2025 |
| England & Wales | partial | DWI annual zone/company compliance; 24 companies, 59.74M consumers (England); 586 events in 2025; some companies publish per-sample open data |
| EU 27 | arriving | Directive (EU) 2020/2184: mandatory risk-based approach; datasets on monitoring results and incidents; catchment risk data by 12 July 2027 |

**Ireland adapter (working):** `scripts/global/ie_ral.py` parses the Uisce Éireann-hosted RAL PDF → `data/global/ie-ral-2025q4.json` (county, supply, scheme code, population, reasons). Chat: questions mentioning Ireland/Irish answer from it (`irelandAnswer`), e.g. "Is Limerick water on the at-risk list in Ireland?". Other countries get a redirect linking `#/global`.

**Next for Ireland:** download the SAFER 2025 results workbook, map exceedances per scheme code into `exceedances[]`, and train/validate against RAL entries (does a supply's prior-year exceedance history predict being added to the RAL?). RAL reasons are parsed from the PDF table layout; verify before quoting individual reasons.
