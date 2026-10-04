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
import { auditLlmNarrative, buildResolverFacts } from './guardrails.js';
import { generateDeterministicSummary } from './fallback-template.js';

export const SHOWCASE_CENTER = { lat: 40.78, lon: -73.97 };

export interface AskInput {
  question: string;
  lat?: number;
  lon?: number;
}

export interface PipelineDeps {
  /** Live compliance fetch. Absent → bundled fixture (recordSource: snapshot_fixture). */
  fetchEcho?: (pwsid: string) => Promise<SdwisComplianceProfile>;
  recordSource?: 'snapshot_fixture' | 'live_fetch';
  narrate?: (schematic: WaterOriginSchematic) => Narrative;
  now?: () => string;
}

const PUBLIC_HEALTH_NOTICE =
  'Reported lab results and regulatory records only; not a real-time safety guarantee.';

function unknownSchematic(now: string): WaterOriginSchematic {
  return {
    pwsid: 'UNKNOWN',
    systemName: 'Area outside showcase snapshot',
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
  const {
    fetchEcho = async (pwsid: string) => readSnapshotCompliance(pwsid, undefined, auditTimestamp),
    recordSource = deps.fetchEcho ? 'live_fetch' : 'snapshot_fixture',
    narrate = narrateGroundTruth,
    now = () => new Date().toISOString(),
  } = deps;
  void input.question; // Reserved for future query parsing / eval logging.
  const auditTimestamp = now();
  const lat = input.lat ?? SHOWCASE_CENTER.lat;
  const lon = input.lon ?? SHOWCASE_CENTER.lon;

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

  const resolverOutput: ResolverOutput = { schematic, extractedFacts: buildResolverFacts(schematic) };
  const narrative = narrate(schematic);
  const audit = auditLlmNarrative(joinNarrative(narrative), resolverOutput);
  const validationStatus = { passedLlmAudit: audit.isValid, auditTimestamp, recordSource };
  if (audit.isValid) {
    return { narrative, groundTruth: schematic, validationStatus };
  }
  const fallbackText = generateDeterministicSummary(schematic);
  return {
    narrative: {
      overview: fallbackText,
      metricsSummary: '',
      complianceNote: '',
      stewardshipNote: schematic.disclaimer,
    },
    groundTruth: schematic,
    validationStatus: { ...validationStatus, passedLlmAudit: false },
  };
}
