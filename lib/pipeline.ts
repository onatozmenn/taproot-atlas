// lib/pipeline.ts — POST /api/ask pipeline (Closes #6).
// Resolver (single authority) → extractedFacts → narrator → audit → fallback.
// Returns ValidatedApiResponse in both pass and fail paths: audit failure still
// answers 200 with the deterministic summary, flagged in validationStatus.
import type {
  ResolverOutput,
  ValidatedApiResponse,
  WaterOriginSchematic,
  SdwisComplianceProfile,
  TreatmentProfile,
  SourceFacilitiesProfile,
  QualityMetricRecord,
  UpstreamSummary,
} from '../types/water-intelligence.js';
import { resolveSystem } from './geo.js';
import { readSnapshotCompliance, pendingCompliance } from './echo.js';
import { loadCityMetrics } from './city-metrics.js';
import { buildSchematicFlow, showcaseNodes, SCHEMATIC_DISCLAIMER } from './schematic.js';
import { narrateGroundTruth, joinNarrative, type Narrative } from './narrator.js';
import { buildFactsMessage } from './llm-narrator.js';
import { auditLlmNarrative, buildResolverFacts } from './guardrails.js';
import { generateDeterministicSummary } from './fallback-template.js';
import { classifyScope, greetingNarrative, offTopicNarrative } from './scope.js';
import { findSystemByText, findSystemCandidates, getDirectorySystem } from './systems.js';
import { findDrinkingPoints, type DrinkingPoint } from './osm.js';
import { fetchTreatment, describeTreatment, readTreatmentFixture } from './treatment.js';
import { readFacilityFixture } from './facility.js';
import { loadLcrMetrics } from './lcr.js';
import { loadUcmrMetrics, loadSyrMetrics, loadDistributionMetrics } from './occurrence.js';
import { loadWaterUse } from './water-use.js';
import { loadConveyances } from './conveyance.js';

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
  /** Sync template or async model narrator. Output is always audited. Receives the user question for grounding. */
  narrate?: (schematic: WaterOriginSchematic, question?: string) => NarrateInput;
  narratorKind?: 'llm' | 'template';
  /** JEV second-layer check. A flag forces fallback; absence/errors never block. */
  jevCheck?: (narrativeText: string, factsText: string) => Promise<{ passed: boolean } | null>;
  /**
   * Nearby-points lookup for UNKNOWN areas. Defaults to the Overpass client
   * (fail-soft, 8s); inject a stub in tests. Never blocks the answer.
   */
  findNearby?: (lat: number, lon: number) => Promise<DrinkingPoint[]>;
  /**
   * Treatment-profile lookup. Defaults to curated fixtures only (no network);
   * live callers wrap fetchTreatment with fixture fallback. Fail-soft.
   */
  fetchTreatmentProfile?: (pwsid: string) => Promise<TreatmentProfile | null>;
  /** SDWIS facility + seller chain. Defaults to fixture only. Fail-soft. */
  fetchFacilitiesProfile?: (pwsid: string) => Promise<SourceFacilitiesProfile | null>;
  /** LCR 90th-percentile rows. Defaults to snapshot (empty until vendored). */
  fetchLcrMetrics?: (pwsid: string) => Promise<QualityMetricRecord[]>;
  /** UCMR occurrence rows. Defaults to snapshot (empty until vendored). */
  fetchUcmrMetrics?: (pwsid: string) => Promise<QualityMetricRecord[]>;
  /** SYR4 extracts. Defaults to snapshot (empty until vendored). */
  fetchSyrMetrics?: (pwsid: string) => Promise<QualityMetricRecord[]>;
  /** Distribution-monitoring rows. Defaults to snapshot (empty until vendored). */
  fetchDistributionMetrics?: (pwsid: string) => Promise<QualityMetricRecord[]>;
  /** NLDI upstream + WQP summary. Defaults to null (live only). Fail-soft. */
  fetchUpstream?: (lon: number, lat: number, label: string) => Promise<UpstreamSummary | null>;
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

function unknownSchematic(now: string, lat?: number, lon?: number): WaterOriginSchematic {
  // Keep the map honest: when the user gave a real location, anchor the
  // schematic there so the view centers on their area — never the NYC
  // showcase default. No service-area claim is made (unverified_fallback).
  const userPointValid =
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180;
  return {
    pwsid: 'UNKNOWN',
    systemName: 'Unserved by showcase snapshot',
    boundaryType: 'unverified_fallback',
    primaryBasins: [],
    schematicFlow: buildSchematicFlow(
      userPointValid
        ? [
            {
              label: 'Your queried location (approximate)',
              role: 'distribution_zone' as const,
              at: [lon as number, lat as number],
            },
          ]
        : [],
    ),
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
    fetchTreatmentProfile = async (pwsid: string) => readTreatmentFixture(pwsid),
    fetchFacilitiesProfile = async (pwsid: string) => readFacilityFixture(pwsid),
    fetchLcrMetrics = async (pwsid: string) => loadLcrMetrics(pwsid),
    fetchUcmrMetrics = async (pwsid: string) => loadUcmrMetrics(pwsid),
    fetchSyrMetrics = async (pwsid: string) => loadSyrMetrics(pwsid),
    fetchDistributionMetrics = async (pwsid: string) => loadDistributionMetrics(pwsid),
    fetchUpstream = async () => null,
  } = deps;
  const question = (input.question ?? '').slice(0, 2000);  const rawLat = input.lat ?? SHOWCASE_CENTER.lat;
  const rawLon = input.lon ?? SHOWCASE_CENTER.lon;
  const lat = isValidCoord(rawLat, rawLon) ? rawLat : SHOWCASE_CENTER.lat;
  const lon = isValidCoord(rawLat, rawLon) ? rawLon : SHOWCASE_CENTER.lon;

  const resolved = resolveSystem(lat, lon);
  // Directory match upgrades off-topic-looking questions ("houston?") to water.
  const dirHit = findSystemByText(question);
  const candidates = findSystemCandidates(question);
  // Ambiguous city alias (boston/kansas city/pittsburgh/chesterfield in two
  // systems): never guess a PWSID. Ask for a state instead.
  if (candidates.length > 1 && !dirHit) {
    const names = candidates.map((c) => `${c.city}, ${c.state} (${c.pwsid})`).join('; ');
    const ambiguousSchematic = unknownSchematic(auditTimestamp, lat, lon);
    try {
      const points = await findNearby(lat, lon);
      const nearest = points.slice(0, 5).map((p) => ({
        name: p.name,
        distanceM: p.distanceM,
        osmUrl: p.osmUrl,
        lat: p.lat,
        lon: p.lon,
      }));
      if (nearest.length > 0) ambiguousSchematic.nearbyDrinkingPoints = nearest;
    } catch {
      // Omit the list; honesty over completeness.
    }
    const aliasLabel = (() => {
      let best = '';
      for (const s of candidates) {
        for (const a of s.aliases) {
          if (question.toLowerCase().includes(a.toLowerCase()) && a.length > best.length) best = a;
        }
      }
      return best || 'that city';
    })();
    return {
      narrative: {
        overview: `Multiple water systems match "${aliasLabel}". Please name a state so the correct record is used: ${names}.`,
        metricsSummary: 'No lab metrics are shown until a single system is named.',
        complianceNote: 'No compliance record is shown until a single system is named. Verify live records at the linked ECHO profile.',
        stewardshipNote: ambiguousSchematic.disclaimer,
      },
      groundTruth: ambiguousSchematic,
      scope: 'water' as const,
      validationStatus: {
        passedLlmAudit: true,
        auditTimestamp,
        recordSource,
        narrator: 'template' as const,
        jev: 'skipped' as const,
      },
    };
  }
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
    schematic = unknownSchematic(auditTimestamp, lat, lon);
    // Best-effort nearby points for uncovered areas. Failure (offline,
    // rate-limited) only omits the list — the answer still returns.
    try {
      const points = await findNearby(lat, lon);
      const nearest = points.slice(0, 5).map((p) => ({ name: p.name, distanceM: p.distanceM, osmUrl: p.osmUrl, lat: p.lat, lon: p.lon }));
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
      sourceKind: 'surface',
      schematicFlow: buildSchematicFlow(showcaseNodes(basins)),
      regulatoryCompliance: compliance,
      latestReportedMetrics: metrics,
      disclaimer: `${PUBLIC_HEALTH_NOTICE} ${SCHEMATIC_DISCLAIMER}`,
    };
  } else {
    // Curated directory city without a vendored polygon: honest unverified
    // boundary, curated basins. Compliance is live when the live adapter is
    // configured (recordSource live_fetch), otherwise pending — never a
    // zero-violations claim.
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
    const compliance =
      recordSource === 'live_fetch'
        ? await loadCompliance(dir.pwsid)
        : pendingCompliance(dir.pwsid, auditTimestamp);
    if (recordSource !== 'live_fetch') effectiveRecordSource = 'snapshot_fixture';
    schematic = {
      pwsid: dir.pwsid,
      systemName: dir.systemName,
      boundaryType,
      primaryBasins: dir.basins.map((b) => b.name),
      sourceKind: dir.sourceKind,
      schematicFlow: buildSchematicFlow([
        ...dir.basins.map((b) => ({
          label: `${b.name} Watershed`,
          role: 'watershed' as const,
          at: b.at,
        })),
        { label: 'Treatment Facility', role: 'treatment_facility' as const, at: [clon + 0.07, clat + 0.12] },
        { label: 'Distribution Zone', role: 'distribution_zone' as const, at: [clon, clat] },
      ]),
      regulatoryCompliance: compliance,
      latestReportedMetrics: loadCityMetrics(dir.pwsid),
      disclaimer: `${PUBLIC_HEALTH_NOTICE} ${SCHEMATIC_DISCLAIMER}`,
    };
    }
  }

  // Best-effort treatment profile (fixture or live delegate). Never blocks.
  if (effectivePwsid !== 'UNKNOWN') {
    try {
      const profile = await fetchTreatmentProfile(effectivePwsid);
      if (profile) {
        schematic.treatment = {
          ...profile,
          rigor: describeTreatment(profile.processes, schematic.sourceKind),
        };
      }
    } catch {
      // Omit the section; honesty over completeness.
    }
    // Best-effort source facilities + seller chain. Never blocks.
    try {
      const fac = await fetchFacilitiesProfile(effectivePwsid);
      if (fac) schematic.sourceFacilities = fac;
    } catch {
      // Omit; honesty over completeness.
    }
    // Best-effort occurrence / monitoring extracts. Never blocks.
    try {
      const lcr = await fetchLcrMetrics(effectivePwsid);
      if (Array.isArray(lcr) && lcr.length > 0) schematic.lcrMetrics = lcr.slice(0, 4);
    } catch { /* omit */ }
    try {
      const ucmr = await fetchUcmrMetrics(effectivePwsid);
      if (Array.isArray(ucmr) && ucmr.length > 0) schematic.ucmrMetrics = ucmr.slice(0, 6);
    } catch { /* omit */ }
    try {
      const syr = await fetchSyrMetrics(effectivePwsid);
      if (Array.isArray(syr) && syr.length > 0) schematic.syrMetrics = syr.slice(0, 6);
    } catch { /* omit */ }
    try {
      const dist = await fetchDistributionMetrics(effectivePwsid);
      if (Array.isArray(dist) && dist.length > 0) schematic.distributionMetrics = dist.slice(0, 4);
    } catch { /* omit */ }
    // Vendored modeled/schematic context (no network, never blocks).
    try {
      const wu = loadWaterUse(effectivePwsid);
      if (wu) schematic.waterUse = wu;
    } catch { /* omit */ }
    try {
      const conv = loadConveyances(effectivePwsid);
      if (conv.length > 0) schematic.conveyances = conv;
    } catch { /* omit */ }
    // Best-effort NLDI upstream (live only, schematic, never blocks).
    try {
      const outlet = schematic.primaryBasins.length > 0
        ? schematic.schematicFlow.features.find((f) => f.properties.role === 'watershed')
        : schematic.schematicFlow.features[0];
      const geom = outlet?.geometry;
      if (geom && geom.type === 'Point') {
        const [olon, olat] = geom.coordinates;
        const label = outlet?.properties.label ?? schematic.primaryBasins[0] ?? schematic.systemName;
        const up = await fetchUpstream(olon, olat, label);
        if (up) schematic.upstream = up;
      }
    } catch {
      // Omit; routes stay schematic without upstream counts.
    }
  }

  // Scope is a gate for every narrator: a directory-city mention counts as
  // water, everything else follows the deterministic classifier. Off-topic
  // and greeting questions return the redirect without invoking the model,
  // so "merhaba" can never become a water report and no model cost is spent.
  const scope = dirHit ? 'water' : classifyScope(question);
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
        narrator: 'template' as const,
        jev: 'skipped' as const,
      },
    };
  }

  // Water scope only from here: the narrator receives the user question plus
  // Resolver facts so answers stay question-specific, and JEV judges the
  // question-aware pair.
  const rawNarrated = await narrate(schematic, question);
  const isWrapped = typeof rawNarrated === 'object' && rawNarrated !== null && 'narrative' in rawNarrated;
  const narrative = isWrapped ? (rawNarrated as NarrateResult).narrative : (rawNarrated as Narrative);
  const usedKind = isWrapped ? (rawNarrated as NarrateResult).kind : narratorKind;
  const joined = joinNarrative(narrative);

  // Template path: deterministic text built from Resolver facts — nothing
  // to judge, JEV stays skipped. Scope is already water here.
  if (usedKind === 'template') {
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
    const verdict = await deps.jevCheck(joined, buildFactsMessage(schematic, question));
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
    // Defense in depth: even a JEV pass never turns a non-water question
    // into a water report. Scope already returned early, so this only fires
    // if the classifier and the model path ever disagree.
    if (scope !== 'water') {
      const redirect = scope === 'greeting' ? greetingNarrative() : offTopicNarrative();
      return {
        narrative: { ...redirect, stewardshipNote: schematic.disclaimer },
        groundTruth: schematic,
        scope: 'redirect',
        validationStatus: { ...validationStatus, passedLlmAudit: false },
      };
    }
    return { narrative, groundTruth: schematic, scope: 'water' as const, validationStatus };
  }
  // Fallback: scope already guarantees water here, so always the
  // deterministic water summary.
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
