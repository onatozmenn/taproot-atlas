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
import { RISK_ASK_RE } from './risk.js';
import { TRIAGE_ASK_RE, stateInText, triage } from './triage.js';
import { findGlossaryEntry, glossaryFollowUps, CONTEXT_FOLLOW_UP_RE } from './glossary.js';
import { findSystemByText, findSystemCandidates, getDirectorySystem, detectPlaceQuery, listDirectorySystems } from './systems.js';
import { findDrinkingPoints, type DrinkingPoint } from './osm.js';
import { fetchTreatment, describeTreatment, readTreatmentFixture } from './treatment.js';
import { readFacilityFixture } from './facility.js';
import { loadLcrMetrics } from './lcr.js';
import { loadUcmrMetrics, loadSyrMetrics, loadDistributionMetrics } from './occurrence.js';
import { loadWaterUse } from './water-use.js';
import { loadConveyances } from './conveyance.js';
import { composeAnswer } from './answer-composer.js';
import {
  loadProfile,
  profileCompliance,
  profileTreatment,
  profileFacilities,
  profileLeadMetrics,
  profileLabMetrics,
  hasProfile,
} from './profile.js';
import { resolveNationalSystem, indexRow, systemCenter, findPlaceInText, type NationalHit } from './national.js';

export const SHOWCASE_CENTER = { lat: 40.78, lon: -73.97 };

export interface AskInput {
  question: string;
  lat?: number;
  lon?: number;
  /**
   * PWSID the previous answer in this conversation was about. A follow-up
   * that names no place ("what about lead?") stays on that system instead of
   * snapping back to the NYC showcase default.
   */
  contextPwsid?: string;
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

const EXAMPLE_FOLLOW_UPS = [
  'Where does Chicago tap water come from?',
  'Is there lead in New York City water?',
  'How does Los Angeles water reach my tap?',
];

/**
 * Public entry: runs the Resolver pipeline, then guarantees a chat answer
 * (question-focused markdown + follow-ups) on every response.
 */
export async function answerTapWater(
  input: AskInput,
  deps: PipelineDeps = {},
): Promise<ValidatedApiResponse> {
  const question = (input.question ?? '').slice(0, 2000);
  const special = await answerSpecial(question, input, deps);
  if (special) return special;
  const out = await answerCore(input, deps);
  if (out.answer) {
    worldCityNote(out, question);
    return out;
  }
  if (out.scope === 'redirect') {
    out.answer = {
      markdown: [out.narrative.overview, out.narrative.metricsSummary].filter(Boolean).join('\n\n'),
      followUps: EXAMPLE_FOLLOW_UPS,
      focus: 'general',
      author: 'template',
    };
  } else if (out.groundTruth.pwsid === 'UNKNOWN') {
    out.answer = {
      markdown: out.narrative.overview,
      followUps: EXAMPLE_FOLLOW_UPS,
      focus: 'general',
      author: 'template',
    };
  } else {
    const c = composeAnswer(out.groundTruth, question);
    out.answer = { markdown: c.markdown, followUps: c.followUps, focus: c.focus, author: 'template' };
  }
  worldCityNote(out, question);
  return out;
}

/** Topics that are clearly not tap water, even when a city is named. */
const OFF_TOPIC_RE =
  /\b(weather|forecast|temperatures?|raining|snowing|restaurants?|hotels?|crime|traffic|news|sports?|stocks?|elections?|jobs?|rent|housing|things to do|tourism|flights?|nightlife|population of|time zone)\b/i;
const COUNTRY_RE =
  /\b(france|england|britain|united kingdom|uk|germany|japan|italy|spain|turkey|t\u00fcrkiye|canada|mexico|china|india|brazil|australia|russia|netherlands|greece|portugal|ireland|egypt|korea|europe|asia|africa)\b/i;
/** World cities that share a name with a small US place. */
const WORLD_CITIES = new Set(['paris', 'london', 'berlin', 'rome', 'madrid', 'athens', 'dublin', 'moscow', 'cairo', 'toronto', 'vancouver', 'lisbon', 'vienna', 'amsterdam', 'florence', 'naples', 'manchester', 'delhi', 'lima', 'sydney', 'melbourne']);

function placeIn(text: string): string | null {
  const hit = findPlaceInText(text);
  return hit ? hit.name : null;
}

/** Distinct places in a "compare A and B" style question. */
function comparedPlaces(question: string): string[] {
  if (!/\b(compare|comparison|versus|vs\.?|difference between|better than)\b/i.test(question) && !/\b(and|or)\b.*\bwater\b/i.test(question)) return [];
  const parts = question.split(/\b(?:and|or|vs\.?|versus|with|to|than)\b|[,;&]/i);
  const out: string[] = [];
  for (const part of parts) {
    const n = placeIn(part);
    if (n && !out.includes(n)) out.push(n);
  }
  return out.length >= 2 ? out : [];
}

/**
 * Questions the record pipeline should not answer as a city report:
 * two-city comparisons, non-water topics that happen to name a city, and
 * places outside the United States. Each gets one honest line and
 * follow-ups that lead back to something Taproot can answer.
 */
async function answerSpecial(question: string, input: AskInput, deps: PipelineDeps): Promise<ValidatedApiResponse | null> {
  const redirect = async (markdown: string, followUps: string[]): Promise<ValidatedApiResponse> => {
    const base = await answerCore({ question: 'hello' }, deps);
    return { ...base, scope: 'redirect', answer: { markdown, followUps: followUps.length ? followUps : EXAMPLE_FOLLOW_UPS, focus: 'general', author: 'template' } };
  };
  // "what is ppb?" after a lead answer is part of the conversation, not
  // off-topic: answer the term in plain words and keep the city context.
  const asksAboutRecords =
    /\b\d{5}\b/.test(question) ||
    placeIn(question) !== null ||
    /\b(levels? (?:of|in)|how much|is there|my water|our water|my tap|in (?:the |my |our )?(?:tap )?water)\b/i.test(question);
  const queue = triageAnswer(question);
  if (queue) return redirect(queue.markdown, queue.followUps);
  const term = asksAboutRecords ? null : findGlossaryEntry(question);
  if (term) {
    const ctx = typeof input.contextPwsid === 'string' ? input.contextPwsid : '';
    const place = ctx ? (getDirectorySystem(ctx)?.city ?? titleCity(indexRow(ctx)?.citiesServed[0] ?? '')) || null : null;
    return redirect(term.answer, glossaryFollowUps(term, place));
  }
  const compared = comparedPlaces(question);
  if (compared.length >= 2) {
    return redirect(
      `I look at one city at a time for now. Pick one to start, then ask about the other.`,
      compared.slice(0, 3).map((c) => `Is ${c} water safe to drink?`),
    );
  }
  if (classifyScope(question) === 'off_topic' && OFF_TOPIC_RE.test(question)) {
    const place = placeIn(question);
    return redirect(
      `I only answer questions about U.S. tap water, so I can't help with that.`,
      place ? [`Is ${place} water safe to drink?`, `Where does ${place} water come from?`] : EXAMPLE_FOLLOW_UPS,
    );
  }
  if (COUNTRY_RE.test(question) && !/\b(new mexico)\b/i.test(question)) {
    return redirect(`Taproot only covers U.S. public water systems, using EPA records. I can't speak to water outside the United States.`, EXAMPLE_FOLLOW_UPS);
  }
  void input;
  return null;
}

/** "Which systems in Ohio are most at risk?" -> the top of the priority queue. */
function triageAnswer(question: string): { markdown: string; followUps: string[] } | null {
  if (!TRIAGE_ASK_RE.test(question)) return null;
  const st = stateInText(question);
  // A single city ("is Flint at risk?") is a forecast question, not a queue.
  if (!st && placeIn(question) !== null) return null;
  const t = triage({ state: st ?? undefined, limit: 3 });
  if (!t || t.rows.length === 0) return null;
  const where = t.stateName ?? 'the U.S.';
  const top = t.rows[0];
  const chance = (p: number) => (p >= 0.95 ? 'a better-than-95% chance' : p < 0.01 ? 'under a 1% chance' : `a ${Math.round(p * 100)}% chance`);
  const people = t.summary.flaggedPeople >= 1_000_000 ? `${Math.round(t.summary.flaggedPeople / 100_000) / 10} million` : t.summary.flaggedPeople.toLocaleString('en-US');
  const scopeHref = `#/triage${t.state ? `?state=${t.state}` : ''}`;
  const markdown = [
    `**${titleCity(top.n)} (${top.c ? `${top.c}, ` : ''}${top.st}) tops ${t.stateName ? `${where}'s` : 'the national'} queue**, with ${chance(top.p)} of a new health-based violation in ${t.meta.year}.`,
    t.summary.flagged > 0
      ? `${t.summary.flagged.toLocaleString('en-US')} of ${t.inScope.toLocaleString('en-US')} scored systems${t.stateName ? ` in ${where}` : ''} fall in the national top 10%, serving ${people} people, and ${t.summary.notOnEttList.toLocaleString('en-US')} of those score under 11 on EPA's enforcement-targeting formula, so it would not flag them yet.`
      : `None of ${t.inScope.toLocaleString('en-US')} scored systems in ${where} fall in the national top 10%.`,
    `[Open the ${t.stateName ?? 'national'} triage queue](${scopeHref})`,
  ].join(' ');
  const followUps = t.rows
    .filter((r) => r.c)
    .slice(0, 2)
    .map((r) => `What's the risk of a violation in ${r.c}, ${r.st} next year?`);
  if (!t.state) followUps.push('Which systems in Texas are most at risk?');
  else if (followUps.length === 0) followUps.push('Which water systems are riskiest nationwide?');
  return { markdown, followUps };
}

function titleCity(raw: string): string {
  return raw.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** Note when a bare world-city name resolved to a small US namesake. */
function worldCityNote(out: ValidatedApiResponse, question: string): void {
  const g = out.groundTruth;
  const name = (g.displayName ?? '').toLowerCase();
  const st = g.profile?.state;
  if (!out.answer || !st || !WORLD_CITIES.has(name)) return;
  if (new RegExp(`,\\s*${st}\\b`).test(question)) return;
  out.answer.markdown = `Taproot covers U.S. water only, so this is ${g.displayName}, ${st}. ${out.answer.markdown}`;
}

async function answerCore(
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
  const namedHit = findSystemByText(question);
  const candidates = findSystemCandidates(question);
  // Conversation context: no city named, no coordinates, no other place ->
  // keep talking about the system from the previous turn.
  // A question that names any US place or ZIP ("Does Phoenix have PFAS?")
  // starts a new subject, even mid-conversation.
  const namesPlace = /\b\d{5}\b/.test(question) || findPlaceInText(question) !== null;
  const contextHit =
    !namedHit &&
    !namesPlace &&
    candidates.length === 0 &&
    input.lat === undefined &&
    typeof input.contextPwsid === 'string' &&
    input.contextPwsid !== 'UNKNOWN' &&
    !detectPlaceQuery(question)
      ? getDirectorySystem(input.contextPwsid)
      : null;
  const dirHit = namedHit ?? contextHit;
  // Nationwide fallback: any US place or ZIP served by one of ~9,700
  // community systems (3,300+ people). Curated directory cities win.
  let nationalHit: NationalHit | null =
    !dirHit && candidates.length === 0 ? resolveNationalSystem(question) : null;
  if (
    !dirHit &&
    !nationalHit &&
    candidates.length === 0 &&
    input.lat === undefined &&
    typeof input.contextPwsid === 'string' &&
    !detectPlaceQuery(question) &&
    !namesPlace &&
    hasProfile(input.contextPwsid)
  ) {
    const row = indexRow(input.contextPwsid);
    if (row) nationalHit = { row, label: row.citiesServed[0] ?? row.name, center: systemCenter(row), alternatives: [] };
  }
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
    // Choices the web ClarifyCard turns into one-tap follow-ups. Each label
    // resolves to exactly one system when asked back ("Chelsea, MA").
    const choiceLabels = [...new Set(candidates.map((c) => `${c.city}, ${c.state}`))];
    if (choiceLabels.length > 1) ambiguousSchematic.alternatives = choiceLabels;
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
  // A supported place outside the directory ("Flint, MI") is a water
  // question with an honest empty state, never a silent NYC default and
  // never an off-topic deflection. Directory hits always win.
  const placeQuery = !dirHit && !nationalHit ? detectPlaceQuery(question) : null;
  // A named city wins over the coordinate polygon: the web chat sends no
  // location, so coords are usually just the NYC default. An explicit city
  // mention is the stronger signal of user intent.
  const dirSystem =
    dirHit && (resolved.pwsid === 'UNKNOWN' || dirHit.pwsid !== resolved.pwsid) ? dirHit : null;
  // Effective system: named directory city first, else polygon, else unknown.
  // An unsupported place forces the unknown path even when the default
  // coordinates would otherwise resolve to the showcase system.
  const effectivePwsid = placeQuery && !dirSystem
    ? 'UNKNOWN'
    : dirSystem
      ? dirSystem.pwsid
      : nationalHit
        ? nationalHit.row.pwsid
        : resolved.pwsid;
  // Compliance fetch with honest degradation: a failed live/source fetch
  // never 502s — NYC degrades to its snapshot, others to pending.
  let effectiveRecordSource = recordSource;
  async function loadCompliance(pwsid: string): Promise<SdwisComplianceProfile> {
    // The vendored SDWIS profile (quarterly ECHO bulk, decoded) is the
    // primary record for every curated system: richer than the live row
    // feed and instant. Live efservice only covers systems without one.
    // Injected source first (live efservice in production, fixtures in
    // tests); the vendored SDWIS profile is the fallback, then pending.
    const fromProfile = () => profileCompliance(pwsid, auditTimestamp);
    if (!deps.fetchEcho && pwsid !== 'NY7003493') {
      const p = fromProfile();
      if (p) {
        effectiveRecordSource = 'snapshot_fixture';
        return p;
      }
    }
    try {
      return await fetchEcho(pwsid);
    } catch {
      effectiveRecordSource = 'snapshot_fixture';
      const p = fromProfile();
      if (p) return p;
      return pwsid === 'NY7003493'
        ? readSnapshotCompliance(pwsid, undefined, auditTimestamp)
        : pendingCompliance(pwsid, auditTimestamp);
    }
  }
  let schematic: WaterOriginSchematic;
  if (effectivePwsid === 'UNKNOWN') {
    // Without user-supplied coordinates the map stays unanchored: the
    // default showcase center is not the user's location, so pointing at it
    // would be dishonest. Explicit coordinates still anchor the view.
    const hasUserCoords = input.lat !== undefined && input.lon !== undefined;
    schematic = hasUserCoords
      ? unknownSchematic(auditTimestamp, lat, lon)
      : unknownSchematic(auditTimestamp);
    // Best-effort nearby points for uncovered areas. Failure (offline,
    // rate-limited) only omits the list — the answer still returns.
    try {
      const points = await findNearby(lat, lon);
      const nearest = points.slice(0, 5).map((p) => ({ name: p.name, distanceM: p.distanceM, osmUrl: p.osmUrl, lat: p.lat, lon: p.lon }));
      if (nearest.length > 0) schematic.nearbyDrinkingPoints = nearest;
    } catch {
      // Omit the list; honesty over completeness.
    }
    // Unsupported place: clear empty state with coverage, never a silent
    // showcase default. Bypasses the narrator (nothing to narrate).
    if (placeQuery) {
      schematic.placeQuery = placeQuery;
      const sample = listDirectorySystems()
        .filter((s) => s.basins.length > 0)
        .sort((a, b) => (b.populationServed ?? 0) - (a.populationServed ?? 0))
        .slice(0, 8)
        .map((s) => s.city);
      return {
        narrative: {
          overview:
            `"${placeQuery}" is not in the current snapshot. The snapshot covers major United States community water systems, ` +
            `including ${sample.join(', ')}. Ask about one of these cities in plain words.`,
          metricsSummary: 'No lab metrics are shown for areas outside the snapshot.',
          complianceNote: 'Verify live records at the linked ECHO system profile.',
          stewardshipNote: schematic.disclaimer,
        },
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
    if (!dir && nationalHit) {
      const row = nationalHit.row;
      const center = nationalHit.center ?? systemCenter(row);
      const nodes: Array<{ label: string; role: 'treatment_facility' | 'distribution_zone'; at: [number, number] }> = center
        ? [
            { label: 'Treatment Facility', role: 'treatment_facility', at: [center[0] + 0.07, center[1] + 0.12] },
            { label: 'Distribution Zone', role: 'distribution_zone', at: center },
          ]
        : [];
      schematic = {
        pwsid: row.pwsid,
        systemName: row.name,
        displayName: nationalHit.label.startsWith('ZIP ') ? row.name : nationalHit.label,
        alternatives: nationalHit.alternatives.length > 0 ? nationalHit.alternatives : undefined,
        boundaryType: 'unverified_fallback',
        primaryBasins: [],
        sourceKind: /^(SW|SWP|GU|GUP)$/.test(row.source) ? 'surface' : /^GW/.test(row.source) ? 'groundwater' : 'unknown',
        schematicFlow: buildSchematicFlow(nodes),
        regulatoryCompliance:
          recordSource === 'live_fetch'
            ? await loadCompliance(row.pwsid)
            : (profileCompliance(row.pwsid, auditTimestamp) ?? pendingCompliance(row.pwsid, auditTimestamp)),
        latestReportedMetrics: [],
        disclaimer: `${PUBLIC_HEALTH_NOTICE} ${SCHEMATIC_DISCLAIMER}`,
      };
    } else if (!dir) {
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
        : (profileCompliance(dir.pwsid, auditTimestamp) ?? pendingCompliance(dir.pwsid, auditTimestamp));
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

  if (effectivePwsid !== 'UNKNOWN') {
    // Best-effort enrichment, fetched in parallel (each live call has its own
    // timeout; any failure only omits that section). Never blocks.
    const settle = async <T>(f: () => Promise<T>): Promise<T | null> => {
      try {
        return await f();
      } catch {
        return null;
      }
    };
    // Vendored EPA profile first (instant, decoded, provenance-stamped);
    // injected/live loaders only fill what the profile lacks.
    const rich = loadProfile(effectivePwsid);
    if (rich) schematic.profile = rich;
    const pick = async <T>(fromProfile: T | null | undefined, f: () => Promise<T>): Promise<T | null> => {
      const ok = Array.isArray(fromProfile) ? fromProfile.length > 0 : Boolean(fromProfile);
      return ok ? (fromProfile as T) : settle(f);
    };
    const curated = effectivePwsid === 'NY7003493';
    const [profile, fac, lcr, ucmr, syr, dist] = await Promise.all([
      pick(rich ? profileTreatment(effectivePwsid) : null, () => fetchTreatmentProfile(effectivePwsid)),
      pick(rich && !curated ? profileFacilities(effectivePwsid) : null, () => fetchFacilitiesProfile(effectivePwsid)),
      pick(rich ? profileLeadMetrics(effectivePwsid) : null, () => fetchLcrMetrics(effectivePwsid)),
      pick(rich ? profileLabMetrics(effectivePwsid, 'UCMR5') : null, () => fetchUcmrMetrics(effectivePwsid)),
      pick(rich ? profileLabMetrics(effectivePwsid, 'SYR4') : null, () => fetchSyrMetrics(effectivePwsid)),
      settle(() => fetchDistributionMetrics(effectivePwsid)),
    ]);
    if (profile) {
      schematic.treatment = { ...profile, rigor: describeTreatment(profile.processes, schematic.sourceKind) };
    }
    if (fac) schematic.sourceFacilities = fac;
    if (Array.isArray(lcr) && lcr.length > 0) schematic.lcrMetrics = lcr.slice(0, 4);
    if (Array.isArray(ucmr) && ucmr.length > 0) schematic.ucmrMetrics = ucmr.slice(0, 6);
    if (Array.isArray(syr) && syr.length > 0) schematic.syrMetrics = syr.slice(0, 6);
    if (Array.isArray(dist) && dist.length > 0) schematic.distributionMetrics = dist.slice(0, 4);
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
  // "is that bad?" / "should I worry?" right after an answer refers to it.
  const contextFollowUp = Boolean(contextHit || (nationalHit && input.contextPwsid)) && CONTEXT_FOLLOW_UP_RE.test(question.trim());
  const scope =
    namedHit || contextFollowUp || (nationalHit && !input.contextPwsid) || (nationalHit && classifyScope(question) !== 'greeting')
      ? 'water'
      : classifyScope(question);
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
    // No JEV configured: the deterministic grounding audit becomes the gate
    // (numbers, entities, health verdicts, coordinates). Any violation falls
    // back to the composed template answer, so no unaudited text exits.
    valid = advisory.isValid;
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
    const composed = composeAnswer(schematic, question);
    const modelAnswer = typeof narrative.answer === 'string' && narrative.answer.trim().length > 0 ? narrative.answer.trim() : null;
    return {
      narrative,
      groundTruth: schematic,
      scope: 'water' as const,
      validationStatus,
      answer: {
        // Forecast questions keep the deterministic wording: the model
        // narrates records, it never restates or reinterprets the score.
        markdown: RISK_ASK_RE.test(question) && composed.markdown ? composed.markdown : modelAnswer ?? narrative.overview,
        followUps: composed.followUps,
        focus: composed.focus,
        author: RISK_ASK_RE.test(question) && composed.markdown ? ('template' as const) : ('llm' as const),
      },
    };
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
