# Water Intelligence

Source-to-Tap Water Intelligence Platform for the Xylem Global Student Innovation Challenge 2026 (Water Quality track, with Access fallback and Quantity context).

## Architecture

1. **Deterministic Resolver** (single authority): resolves PWSID via point-in-polygon, classifies boundary confidence (`verified_agency` / `modeled_epa` / `unverified_fallback`), loads reported lab metrics and SDWIS compliance window, builds schematic GeoJSON (approximate, never an engineering alignment).
2. **Guardrail audit** (`lib/guardrails.ts`): English-only, blocks health certification, coordinate leaks, numeric/entity hallucinations.
3. **LLM narrator** (English only, `prompts/system.ts`): summarizes Resolver facts for citizens. Adds no numbers, coordinates, or verdicts.
4. **Deterministic fallback** (`lib/fallback-template.ts`): full-provenance summary rendered directly from ground truth when audit fails.
5. **Frontend** (planned): map with schematic flow + Verified/Modeled badges + report cards. Every metric shows test date, report period, capture time, and source link.

## Data layers

- Service boundary and origin: EPA Service Area Boundaries (PWSID) + NYC DEP watershed schematic. Labeled Verified vs Modeled.
- Compliance: EPA SDWIS / ECHO with explicit 5-year query window.
- Tap quality: NYC distribution monitoring + Annual Drinking Water Supply and Quality Report. Reported lab tests only. No real-time safety guarantee.
- Public access fallback: OpenStreetMap `amenity=drinking_water` outside the showcase boundary.

## Health and honesty rules

- Never output "safe", "drinkable", "pure", or equivalents as a verdict.
- Frame findings as regulatory compliance with date, threshold, and source.
- Schematic paths are approximations.
- Zero violations is reported as "no records found in window", with ECHO link.

## Showcase

Primary showcase: New York City (PWSID example: NYC DEP system). Global fallback: nearby public drinking points with an explicit unverified-boundary notice.
