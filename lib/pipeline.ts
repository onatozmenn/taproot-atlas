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
import { readSnapshotCompliance, pendingCompliance } from './echo.js';
import type { SdwisComplianceProfile } from '../types/water-intelligence.js';
import { loadCityMetrics } from './city-metrics.js';
import { buildSchematicFlow, showcaseNodes, SCHEMATIC_DISCLAIMER } from './schematic.js';
import { narrateGroundTruth, joinNarrative, type Narrative } from './narrator.js';
import { buildFactsMessage } from './llm-narrator.js';
import { auditLlmNarrative, buildResolverFacts } from './guardrails.js';
import { generateDeterministicSummary } from './fallback-template.js';
import { classifyScope, greetingNarrative, offTopicNarrative } from './scope.js';
import { findSystemByText, getDirectorySystem } from './systems.js';
import { findDrinkingPoints, type DrinkingPoint } from './osm.js';

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
  /**
   * Nearby-points lookup for UNKNOWN areas. Defaults to the Overpass client
   * (fail-soft, 8s); inject a stub in tests. Never blocks the answer.
   */
  findNearby?: (lat: number, lon: number) => Promise<DrinkingPoint[]>;
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
    // Pending, not zero: there are no records here to count.
    regulatoryCompliance: pendingCompliance('UNKNOWN', now),
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
    findNearby = (aLat: number, aLon: number) => findDrinkingPoints(aLat, aLon, { timeoutMs: 8000 }),
  } = deps;
  const question = (input.question ?? '').slice(0, 2000);  const rawLat = input.lat ?? SHOWCASE_CENTER.lat;
  const rawLon = input.lon ?? SHOWCASE_CENTER.lon;
  const lat = isValidCoord(rawLat, rawLon) ? rawLat : SHOWCASE_CENTER.lat;
  const lon = isValidCoord(rawLat, rawLon) ? rawLon : SHOWCASE_CENTER.lon;

  const resolved = resolveSystem(lat, lon);
  // Directory match upgrades off-topic-looking questions ("houston?") to water.
  const dirHit = findSystemByText(question);
  // A named city wins over the coordinate polygon: the web chat sends no
  // location, so coords are usually just the NYC default. An explicit city
  // mention is the stronger signal of user intent.
  const dirSystem =
    dirHit && (resolved.pwsid === 'UNKNOWN' || dirHit.pwsid !== resolved.pwsid) ? dirHit : null;
  // Effective system: named directory city first, else polygon, else unknown.
  const effectivePwsid = dirSystem ? dirSystem.pwsid : resolved.pwsid;
  // Compliance fetch with honest degradation: a failed live/source fetch
  // never 502s — NYC degrades to its snapshot, others to pending.
  let effectiveRecordSource = recordSource;
  async function loadCompliance(pwsid: string): Promise<SdwisComplianceProfile> {
    try {
      return await fetchEcho(pwsid);
    } catch {
      effectiveRecordSource = 'snapshot_fixture';
      return pwsid === 'NY7003493'
        ? readSnapshotCompliance(pwsid, undefined, auditTimestamp)
        : pendingCompliance(pwsid, auditTimestamp);
    }
  }
  let schematic: WaterOriginSchematic;
  if (effectivePwsid === 'UNKNOWN') {
    schematic = unknownSchematic(auditTimestamp);
    // Best-effort nearby points for uncovered areas. Failure (offline,
    // rate-limited) only omits the list — the answer still returns.
    try {
      const points = await findNearby(lat, lon);
      const nearest = points.slice(0, 5).map((p) => ({ name: p.name, distanceM: p.distanceM, osmUrl: p.osmUrl }));
      if (nearest.length > 0) schematic.nearbyDrinkingPoints = nearest;
    } catch {
      // Omit the list; honesty over completeness.
    }
  } else if (effectivePwsid === 'NY7003493') {
    const basins = resolved.pwsid !== 'UNKNOWN' ? resolved.primaryBasins : (dirSystem?.basins.map((b) => b.name) ?? []);
    const [compliance, metrics] = await Promise.all([
      loadCompliance(effectivePwsid),
      Promise.resolve(loadCityMetrics(effectivePwsid)),
    ]);
    schematic = {
      pwsid: effectivePwsid,
      systemName: resolved.pwsid !== 'UNKNOWN' ? resolved.systemName : (dirSystem?.systemName ?? 'NYC DEP Catskill-Delaware'),
      boundaryType: 'modeled_epa',
      primaryBasins: basins,
      schematicFlow: buildSchematicFlow(showcaseNodes(basins)),
      regulatoryCompliance: compliance,
      latestReportedMetrics: metrics,
      disclaimer: `${PUBLIC_HEALTH_NOTICE} ${SCHEMATIC_DISCLAIMER}`,
    };
  } else {
    // Curated directory city without a vendored polygon: honest unverified
    // boundary, curated basins, pending compliance, no lab metrics yet.
    // Pending shells are static, never live — label them as such.
    effectiveRecordSource = 'snapshot_fixture';
    const dir = dirSystem ?? getDirectorySystem(effectivePwsid);
    if (!dir) {
      // Polygon hit outside the curated directory: answer from the resolved
      // location with pending compliance and location-anchored schematic
      // points (approximate, as always).
      schematic = {
        pwsid: effectivePwsid,
        systemName: resolved.systemName,
        boundaryType: resolved.boundaryType,
        primaryBasins: resolved.primaryBasins,
        schematicFlow: buildSchematicFlow([
          { label: 'Treatment Facility', role: 'treatment_facility' as const, at: [lon + 0.07, lat + 0.12] },
          { label: 'Distribution Zone', role: 'distribution_zone' as const, at: [lon, lat] },
        ]),
        regulatoryCompliance: pendingCompliance(effectivePwsid, auditTimestamp),
        latestReportedMetrics: [],
        disclaimer: `${PUBLIC_HEALTH_NOTICE} ${SCHEMATIC_DISCLAIMER}`,
      };
    } else {
    const [clon, clat] = dir.center;
    // When the coordinate polygon matched the same system, its EPA boundary
    // verdict stands (Verified rings included). A pure name match stays
    // unverified — the user's location is unproven.
    const boundaryType =
      resolved.pwsid === dir.pwsid ? resolved.boundaryType : dir.boundaryType;
    schematic = {
      pwsid: dir.pwsid,
      systemName: dir.systemName,
      boundaryType,
      primaryBasins: dir.basins.map((b) => b.name),
      schematicFlow: buildSchematicFlow([
        ...dir.basins.map((b) => ({
          label: `${b.name} Watershed`,
          role: 'watershed' as const,
          at: b.at,
        })),
        { label: 'Treatment Facility', role: 'treatment_facility' as const, at: [clon + 0.07, clat + 0.12] },
        { label: 'Distribution Zone', role: 'distribution_zone' as const, at: [clon, clat] },
      ]),
      regulatoryCompliance: pendingCompliance(dir.pwsid, auditTimestamp),
      latestReportedMetrics: loadCityMetrics(dir.pwsid),
      disclaimer: `${PUBLIC_HEALTH_NOTICE} ${SCHEMATIC_DISCLAIMER}`,
    };
    }
  }

  // Routing hint, not a gate: a directory-city mention counts as water, and
  // the template path plus fallback selection use it below. Model output is
  // judged by JEV alone.
  const scope = dirHit ? 'water' : classifyScope(question);

  const rawNarrated = await narrate(schematic);
  const isWrapped = typeof rawNarrated === 'object' && rawNarrated !== null && 'narrative' in rawNarrated;
  const narrative = isWrapped ? (rawNarrated as NarrateResult).narrative : (rawNarrated as Narrative);
  const usedKind = isWrapped ? (rawNarrated as NarrateResult).kind : narratorKind;
  const joined = joinNarrative(narrative);

  // Template path: deterministic text built from Resolver facts (or the
  // scope redirect) — nothing to judge, JEV stays skipped.
  if (usedKind === 'template') {
    if (scope !== 'water') {
      const redirect = scope === 'greeting' ? greetingNarrative() : offTopicNarrative();
      return {
        narrative: { ...redirect, stewardshipNote: schematic.disclaimer },
        groundTruth: schematic,
        scope: 'redirect',
        validationStatus: {
          passedLlmAudit: true,
          auditTimestamp,
          recordSource: effectiveRecordSource,
          narrator: 'template',
          jev: 'skipped',
        },
      };
    }
    return {
      narrative,
      groundTruth: schematic,
      scope: 'water' as const,
      validationStatus: {
        passedLlmAudit: true,
        auditTimestamp,
        recordSource: effectiveRecordSource,
        narrator: 'template' as const,
        jev: 'skipped' as const,
      },
    };
  }

  // Model path: the JEV verdict is the sole gate. The deterministic audit
  // below is advisory telemetry only — logged, never blocking.
  const resolverOutput: ResolverOutput = { schematic, extractedFacts: buildResolverFacts(schematic) };
  const advisory = auditLlmNarrative(joined, resolverOutput);
  if (!advisory.isValid) {
    console.error(`[pipeline] advisory guardrail notes: ${advisory.violations.join(' | ')}`);
  }
  let jev: 'pass' | 'flag' | 'skipped' = 'skipped';
  let valid: boolean;
  if (deps.jevCheck) {
    const verdict = await deps.jevCheck(joined, buildFactsMessage(schematic));
    if (verdict) {
      jev = verdict.passed ? 'pass' : 'flag';
      valid = verdict.passed;
    } else {
      // JEV outage or unparsable verdict: fail closed, no model text exits.
      console.error('[pipeline] JEV gave no verdict for model output; using template fallback');
      valid = false;
    }
  } else {
    // A model narrator without a judge: fail closed.
    console.error('[pipeline] model narrator without a JEV gate; using template fallback');
    valid = false;
  }
  const validationStatus = { passedLlmAudit: valid, auditTimestamp, recordSource: effectiveRecordSource, narrator: usedKind, jev };
  if (valid) {
    return { narrative, groundTruth: schematic, scope: 'water' as const, validationStatus };
  }
  // Fallback selection follows the routing hint: off-topic questions get the
  // redirect, everything else the deterministic water summary.
  if (scope !== 'water') {
    const redirect = scope === 'greeting' ? greetingNarrative() : offTopicNarrative();
    return {
      narrative: { ...redirect, stewardshipNote: schematic.disclaimer },
      groundTruth: schematic,
      scope: 'redirect',
      validationStatus: { ...validationStatus, passedLlmAudit: false },
    };
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
