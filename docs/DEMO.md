# Demo script — taproot-atlas (3 minutes, no narration gaps)

Run on the preview URL (see README “Preview deploys”). All answers are
snapshot-backed, so the demo works offline-proof on stage.

## Q1 — “Where does my tap water come from?” (60s)
- Shows: system name + PWSID, Catskill and Delaware basins, Modeled boundary badge.
- Say: “The Resolver owns every fact; the chat only narrates.”
- Point at: schematic overlay on real OSM tiles + attribution corner.

## Q2 — “Any violations in the last 5 years?” (60s)
- Shows: 2021-01-01 → 2026-01-01 window, “0 violation(s) found”, ECHO link, capture time.
- Say: “Zero is reported as no records found in window — never safe or clean.”
- Click: the ECHO profile link (public EPA page).

## Q3 — click the “What did the 2024 Annual report test for Turbidity?” chip (60s)
- Shows: MetricCard with value, threshold, test date, report period, version, source link.
- Say: “Every number traces to a dated filing. Ask in Turkish — the answer stays English and grounded.”
- Point at: the metric cards with test date, report period, version, and source link.

## Track mapping (one-pager for the jury)

| Xylem track | Where it lives in this repo |
| ----------- | --------------------------- |
| Water Quality (main) | PWSID resolver, NYC lab metrics with provenance, SDWIS 5-year window, guarded narrator |
| Water Access (fallback) | OSM `amenity=drinking_water` lookup, always `unverified_fallback`, never a Verified badge |
| Water Quantity (context) | Watershed sourcing story + reservoir levels linked from NYC DEP pages; ECHO pollutant-loading links in `docs/DATA.md` scope |

## Honesty lines (memorize one)
- “Reported lab results and regulatory records only — not a real-time safety guarantee.”
- “Schematic map, not engineering.”
