# Architecture — taproot-atlas

Product scope (three pillars, in order): where tap water comes from (system +
PWSID + basins + source kind), what is in it (reported lab metrics + dated
SDWIS compliance, Xylem Water Quality track), how it reaches the tap
(schematic watershed → treatment → distribution pathway + reported treatment).

```
user question (America.gov-style chat, web/)
  -> Resolver (single authority; owns PWSID, basins, metrics, SDWIS window, GeoJSON)
  -> narrator: deterministic template, or LLM draft (prompts/system.ts)
  -> JEV verdict (lib/jev-audit.ts; grounding, health-cert, coords, off-topic)
       template path -> accepted directly (nothing to judge)
       llm + pass  -> narrative + groundTruth + validationStatus.passedLlmAudit=true
       llm + flag/absent -> deterministic fallback (water summary or scope
         redirect), passedLlmAudit=false. No model text exits without a verdict.
  -> web renders AnswerCard + SchematicMap + provenance links
```

## Invariants

- Resolver facts are the ONLY source of numbers, basin names, parameters.
- Narrator adds no coordinates; map geometries stay Resolver-exclusive.
- Every metric carries testDate + reportPeriod + captureTime + sourceVersionId + sourceDocumentUrl.
- Boundary confidence is always resolved: verified_agency / modeled_epa / unverified_fallback
  (shown via map + compliance, not as a user-facing badge).
- English-only output; input may be any language.
- Deterministic guardrails (lib/guardrails.ts) are advisory telemetry only:
  violations are logged server-side, never blocking. The JEV verdict is the
  sole gate for model output.

## Data contracts

See `types/water-intelligence.ts`: WaterOriginSchematic, SdwisComplianceProfile,
QualityMetricRecord, ResolverOutput, ValidatedApiResponse.

## Roadmap hooks (issues #1-20)

Resolver clients (ECHO, NYC ingest, OSM fallback, point-in-polygon), eval set for
guardrails, API route (`POST /api/ask`), real map tiles behind the schematic layer.
