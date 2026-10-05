// lib/pipeline.ts — POST /api/ask pipeline (Closes #6).
// Resolver (single authority) → extractedFacts → narrator → audit → fallback.
// Returns ValidatedApiResponse in both pass and fail paths: audit failure still
// answers 200 with the deterministic summary, flagged in validationStatus.
import type {
  ResolverOutput,
  ValidatedApiResponse,
  WaterOriginSchematic,
} from '../types/water-intelligence.js';
import { resolveSystem } from './geo.js';
import { readSnapshotCompliance, echoReportUrl, ECHO_QUERY_WINDOW } from './echo.js';
import type { SdwisComplianceProfile } from '../types/water-intelligence.js';
import { ingestNycMetrics } from './nyc.js';
import { buildSchematicFlow, showcaseNodes, SCHEMATIC_DISCLAIMER } from './schematic.js';
import { narrateGroundTruth, joinNarrative, type Narrative } from './narrator.js';
import { buildFactsMessage } from './llm-narrator.js';
import { auditLlmNarrative, buildResolverFacts } from './guardrails.js';
import { generateDeterministicSummary } from './fallback-template.js';
import { classifyScope, greetingNarrative, offTopicNarrative } from './scope.js';

export const SHOWCASE_CENTER = { lat: 40.78, lon: -73.97 };

export interface AskInput {
  question: string;
  lat?: number;
  lon?: number;
}

export interface NarrateResult {
  narrative: Narrative;
  kind: 'llm' | 'template';
}

export type NarrateInput = Narrative | NarrateResult | Promise<Narrative | NarrateResult>;

export interface PipelineDeps {
  /** Live compliance fetch. Absent → bundled fixture (recordSource: snapshot_fixture). */
  fetchEcho?: (pwsid: string) => Promise<SdwisComplianceProfile>;
  /** Explicit source label. Defaults to snapshot_fixture; live callers must pass live_fetch. */
  recordSource?: 'snapshot_fixture' | 'live_fetch';
  /** Sync template or async model narrator. Output is always audited. */
  narrate?: (schematic: WaterOriginSchematic) => NarrateInput;
  narratorKind?: 'llm' | 'template';
  /** JEV second-layer check. A flag forces fallback; absence/errors never block. */
  jevCheck?: (narrativeText: string, factsText: string) => Promise<{ passed: boolean } | null>;
  now?: () => string;
}

const PUBLIC_HEALTH_NOTICE =
  'Reported lab results and regulatory records only; not a real-time safety guarantee.';

function isValidCoord(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function unknownSchematic(now: string): WaterOriginSchematic {
  return {
    pwsid: 'UNKNOWN',
    systemName: 'Unserved by showcase snapshot',
    boundaryType: 'unverified_fallback',
    primaryBasins: [],
    schematicFlow: buildSchematicFlow([]),
    regulatoryCompliance: {
      pwsid: 'UNKNOWN',
      queryWindow: { ...ECHO_QUERY_WINDOW },
      totalViolationsFound: 0,
      records: [],
      echoReportUrl: echoReportUrl('UNKNOWN'),
      dataCaptureTime: now,
    },
    latestReportedMetrics: [],
    disclaimer: `${PUBLIC_HEALTH_NOTICE} Nearby public drinking-water points can be looked up via OpenStreetMap; boundaries there are unverified. ${SCHEMATIC_DISCLAIMER}`,
  };
}

export async function answerTapWater(
  input: AskInput,
  deps: PipelineDeps = {},
): Promise<ValidatedApiResponse> {
  const now = deps.now ?? (() => new Date().toISOString());
  const auditTimestamp = now();
  const {
    fetchEcho = async (pwsid: string) => readSnapshotCompliance(pwsid, undefined, auditTimestamp),
    recordSource = deps.recordSource ?? 'snapshot_fixture',
    narrate = narrateGroundTruth,
    narratorKind = deps.narrate ? 'llm' : 'template',
  } = deps;
  const question = (input.question ?? '').slice(0, 2000);
  const rawLat = input.lat ?? SHOWCASE_CENTER.lat;
  const rawLon = input.lon ?? SHOWCASE_CENTER.lon;
  const lat = isValidCoord(rawLat, rawLon) ? rawLat : SHOWCASE_CENTER.lat;
  const lon = isValidCoord(rawLat, rawLon) ? rawLon : SHOWCASE_CENTER.lon;

  const resolved = resolveSystem(lat, lon);
  let schematic: WaterOriginSchematic;
  if (resolved.pwsid === 'UNKNOWN') {
    schematic = unknownSchematic(auditTimestamp);
  } else {
    const [compliance, metrics] = await Promise.all([
      fetchEcho(resolved.pwsid),
      Promise.resolve(ingestNycMetrics(resolved.pwsid)),
    ]);
    schematic = {
      pwsid: resolved.pwsid,
      systemName: resolved.systemName,
      boundaryType: resolved.boundaryType,
      primaryBasins: resolved.primaryBasins,
      schematicFlow: buildSchematicFlow(showcaseNodes(resolved.primaryBasins)),
      regulatoryCompliance: compliance,
      latestReportedMetrics: metrics,
      disclaimer: `${PUBLIC_HEALTH_NOTICE} ${SCHEMATIC_DISCLAIMER}`,
    };
  }

  // Scope gate: off-topic questions get a short redirect, never the report.
  const scope = classifyScope(question);
  if (scope !== 'water') {
    const redirect = scope === 'greeting' ? greetingNarrative() : offTopicNarrative();
    return {
      narrative: { ...redirect, stewardshipNote: schematic.disclaimer },
      groundTruth: schematic,
      scope: 'redirect',
      validationStatus: {
        passedLlmAudit: true,
        auditTimestamp,
        recordSource,
        narrator: 'template',
        jev: 'skipped',
      },
    };
  }

  const resolverOutput: ResolverOutput = { schematic, extractedFacts: buildResolverFacts(schematic) };
  const rawNarrated = await narrate(schematic);
  const isWrapped = typeof rawNarrated === 'object' && rawNarrated !== null && 'narrative' in rawNarrated;
  const narrative = isWrapped ? (rawNarrated as NarrateResult).narrative : (rawNarrated as Narrative);
  const usedKind = isWrapped ? (rawNarrated as NarrateResult).kind : narratorKind;
  const joined = joinNarrative(narrative);
  const audit = auditLlmNarrative(joined, resolverOutput);
  let jev: 'pass' | 'flag' | 'skipped' = 'skipped';
  let valid = audit.isValid;
  if (valid && deps.jevCheck) {
    const verdict = await deps.jevCheck(joined, buildFactsMessage(schematic));
    if (verdict) {
      jev = verdict.passed ? 'pass' : 'flag';
      if (!verdict.passed) valid = false;
    }
  }
  const validationStatus = { passedLlmAudit: valid, auditTimestamp, recordSource, narrator: usedKind, jev };
  if (valid) {
    return { narrative, groundTruth: schematic, scope: 'water' as const, validationStatus };
  }
  const fallbackText = generateDeterministicSummary(schematic);
  // Populate all narrative fields so the UI never renders empty sections.
  const templateFallback = narrateGroundTruth(schematic);
  return {
    narrative: {
      overview: fallbackText,
      metricsSummary: templateFallback.metricsSummary,
      complianceNote: templateFallback.complianceNote,
      stewardshipNote: schematic.disclaimer,
    },
    groundTruth: schematic,
    scope: 'water' as const,
    validationStatus: { ...validationStatus, passedLlmAudit: false },
  };
}
