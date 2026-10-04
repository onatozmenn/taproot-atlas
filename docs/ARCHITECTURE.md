# Architecture — taproot-atlas

```
user question (America.gov-style chat, web/)
  -> Resolver (single authority; owns PWSID, basins, metrics, SDWIS window, GeoJSON)
  -> extractedFacts { allowedNumbers, allowedEntities }
  -> LLM narrator (prompts/system.ts; English only; summarizes facts)
  -> auditLlmNarrative (lib/guardrails.ts)
      pass -> narrative + groundTruth + validationStatus.passedLlmAudit=true
      fail -> generateDeterministicSummary (lib/fallback-template.ts), passedLlmAudit=false
  -> web renders AnswerCard + SchematicMap + provenance links
```

## Invariants

- Resolver facts are the ONLY source of numbers, basin names, parameters.
- Narrator adds no coordinates; map geometries stay Resolver-exclusive.
- Every metric carries testDate + reportPeriod + captureTime + sourceVersionId + sourceDocumentUrl.
- Boundary confidence is always shown: verified_agency / modeled_epa / unverified_fallback.
- English-only output (audit enforced); input may be any language.

## Data contracts

See `types/water-intelligence.ts`: WaterOriginSchematic, SdwisComplianceProfile,
QualityMetricRecord, ResolverOutput, ValidatedApiResponse.

## Roadmap hooks (issues #1-20)

Resolver clients (ECHO, NYC ingest, OSM fallback, point-in-polygon), eval set for
guardrails, API route (`POST /api/ask`), real map tiles behind the schematic layer.
