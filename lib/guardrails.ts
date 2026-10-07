// lib/guardrails.ts
// English-only deterministic audit for LLM narrator output.
// Blocks health certification, coordinate leaks, numeric/entity hallucinations,
// and non-English output. Falls back to a deterministic template on failure.
import { profileFacts, flattenFacts } from './profile.js';
import type {
  QualityMetricRecord,
  WaterOriginSchematic,
  ResolverOutput,
} from '../types/water-intelligence.js';

export interface AuditResult {
  isValid: boolean;
  violations: string[];
}

export function extractNormalizedNumbers(text: string): string[] {
  const matches = text.match(/\b\d+(?:\.\d+)?\b/g) || [];
  return matches;
}

/** Digit runs glued to a following letter (e.g. "15ppb", "02T"). */
export function extractGluedNumbers(text: string): string[] {
  const out: string[] = [];
  const re = /(?<![\d.])(\d+(?:\.\d+)?)(?=[A-Za-z])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

export function normalizeNumericToken(token: string): string {
  const n = Number(token);
  if (!Number.isFinite(n)) return token;
  // Canonical form so "0.080" and "0.08" compare equal.
  return String(n);
}

function normalizeNumberList(tokens: string[]): Set<string> {
  return new Set(tokens.map(normalizeNumericToken));
}

export function buildResolverFacts(
  schematic: WaterOriginSchematic
): ResolverOutput['extractedFacts'] {
  const rawSources: string[] = [
    schematic.regulatoryCompliance.queryWindow.startDate,
    schematic.regulatoryCompliance.queryWindow.endDate,
    schematic.regulatoryCompliance.dataCaptureTime,
    String(schematic.regulatoryCompliance.totalViolationsFound),
    schematic.pwsid,
  ];

  const allowedEntities: string[] = [
    schematic.pwsid.toLowerCase(),
    schematic.systemName.toLowerCase(),
    ...schematic.primaryBasins.map((b: string) => b.toLowerCase()),
  ];

  for (const m of schematic.latestReportedMetrics) {
    rawSources.push(m.reportedValue);
    rawSources.push(m.regulatoryThreshold);
    rawSources.push(m.testDate);
    rawSources.push(m.provenance.reportPeriod);
    rawSources.push(m.provenance.captureTime);
    rawSources.push(m.provenance.sourceVersionId);
    allowedEntities.push(m.parameter.toLowerCase());
  }

  for (const group of [
    schematic.lcrMetrics ?? [],
    schematic.ucmrMetrics ?? [],
    schematic.syrMetrics ?? [],
    schematic.distributionMetrics ?? [],
  ]) {
    for (const m of group) {
      rawSources.push(m.reportedValue);
      rawSources.push(m.regulatoryThreshold);
      rawSources.push(m.testDate);
      rawSources.push(m.provenance.reportPeriod);
      rawSources.push(m.provenance.captureTime);
      rawSources.push(m.provenance.sourceVersionId);
      allowedEntities.push(m.parameter.toLowerCase());
    }
  }

  for (const f of schematic.schematicFlow.features) {
    allowedEntities.push(f.properties.label.toLowerCase());
  }

  if (schematic.sourceFacilities) {
    rawSources.push(schematic.sourceFacilities.dataCaptureTime);
    for (const f of schematic.sourceFacilities.facilities) {
      allowedEntities.push(f.facilityName.toLowerCase());
    }
    for (const s of schematic.sourceFacilities.sellerChain) {
      allowedEntities.push(s.systemName.toLowerCase());
      allowedEntities.push(s.pwsid.toLowerCase());
    }
  }
  if (schematic.upstream) {
    rawSources.push(String(schematic.upstream.upstreamCount));
    rawSources.push(String(schematic.upstream.stationCount));
    rawSources.push(schematic.upstream.dataCaptureTime);
    allowedEntities.push(schematic.upstream.outletLabel.toLowerCase());
    for (const c of schematic.upstream.characteristics) allowedEntities.push(c.toLowerCase());
  }
  if (schematic.waterUse) {
    rawSources.push(String(schematic.waterUse.surfacePct));
    rawSources.push(String(schematic.waterUse.groundPct));
    rawSources.push(schematic.waterUse.referencePeriod);
  }
  for (const c of schematic.conveyances ?? []) allowedEntities.push(c.name.toLowerCase());
  if (schematic.profile) {
    const p = schematic.profile;
    rawSources.push(...flattenFacts(profileFacts(p)));
    for (const s of p.sources) allowedEntities.push(s.name.toLowerCase());
    for (const n of p.plants) allowedEntities.push(n.toLowerCase());
    for (const s of p.purchasedFrom) allowedEntities.push(s.name.toLowerCase());
    for (const a of p.lab) allowedEntities.push(a.label.toLowerCase(), a.name.toLowerCase());
    for (const c of p.counties) allowedEntities.push(c.toLowerCase());
  }

  const allowedNumbers = Array.from(
    new Set(rawSources.flatMap((text) => extractNormalizedNumbers(text)).map(normalizeNumericToken))
  );

  const allowedGluedNumbers = Array.from(
    new Set(rawSources.flatMap((text) => extractGluedNumbers(text)).map(normalizeNumericToken))
  );

  return {
    allowedNumbers,
    allowedGluedNumbers,
    allowedEntities: Array.from(new Set(allowedEntities)),
  };
}

const APPROVED_SENTENCE_EXCEPTIONS: RegExp[] = [
  /safe drinking water act/i,
  /standard for safe drinking water/i,
  /within (?:safe|allowable|acceptable) limits/i,
  /compliance with safe drinking water/i,
  /clean water act/i,
];

const STRICT_ASSERTION_TERMS = [
  'drinkable',
  'potable',
  'guaranteed clean',
  'pure',
  'certified safe',
  'harmless',
  '100% clean',
];

const SENSITIVE_TERMS = ['safe', 'clean', 'healthy'];

const ENTITY_PATTERNS = [
  /([\w\s-]+?)\s+(?:basin|reservoir|watershed|facility|treatment plant|aqueduct)\b/gi,
  /(?:level of|concentration of|amount of)\s+([\w\s-]+)\b/gi,
];

function splitIntoSentences(text: string): string[] {
  // Protect common abbreviations so "e.g." / "i.e." don't split sentences.
  const protectedText = text
    .replace(/\be\.g\./gi, 'e<eg>')
    .replace(/\bi\.e\./gi, 'i<ie>');
  return protectedText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/e<eg>/g, 'e.g.').replace(/i<ie>/g, 'i.e.'))
    .filter(Boolean);
}

/** Strict entity match: exact entity or standalone single-word entity.
 * Avoids "cat" matching "catskill" via substring, and bare "treatment"
 * matching the real label "treatment facility" (narrator must avoid
 * facility words; see evals E10 vs F12). Basin names pass because they
 * exist as standalone primaryBasins entries. */
function entityAllowed(candidate: string, allowedList: string[]): boolean {
  const allowedSet = new Set(allowedList.map((e) => e.toLowerCase().trim()));
  const singleWordAllowed = new Set(
    [...allowedSet].filter((e) => e.length > 0 && !e.includes(' ') && !e.includes('-')),
  );
  let cand = candidate.toLowerCase().trim();
  // Strip leading articles/conjunctions/prepositions captured by the lazy prefix.
  cand = cand.replace(/^(?:the|a|an|and|or|of|at|in|to|from)\s+/i, '').trim();
  // Re-strip repeatedly (e.g. "and the croton").
  let prev = '';
  while (prev !== cand) {
    prev = cand;
    cand = cand.replace(/^(?:the|a|an|and|or|of|at|in|to|from)\s+/i, '').trim();
  }
  if (!cand) return true;
  if (allowedSet.has(cand)) return true;
  const tokens = cand.split(/[^a-z0-9]+/).filter(Boolean);
  const head = tokens[tokens.length - 1] ?? '';
  // Head word passes only if it exists as a standalone allowed entity
  // (e.g. "catskill" from primaryBasins), never as a fragment of a
  // longer label (e.g. "treatment" from "treatment facility").
  if (head && singleWordAllowed.has(head)) return true;
  return false;
}

export function auditLlmNarrative(
  narrativeText: string,
  resolverOutput: ResolverOutput
): AuditResult {
  const violations: string[] = [];

  if (/[^\x00-\x7F]/.test(narrativeText)) {
    violations.push(
      'Language violation: Non-ASCII characters detected. The response must be strictly in standard English.'
    );
  }

  for (const term of STRICT_ASSERTION_TERMS) {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    if (regex.test(narrativeText)) {
      violations.push(
        `Forbidden unconditional assertion: "${term}". Use regulatory compliance phrasing instead.`
      );
    }
  }

  const sentences = splitIntoSentences(narrativeText);
  for (const sentence of sentences) {
    for (const term of SENSITIVE_TERMS) {
      const regex = new RegExp(`\\b${term}\\b`, 'i');
      if (regex.test(sentence)) {
        const isApproved = APPROVED_SENTENCE_EXCEPTIONS.some((ex) =>
          ex.test(sentence)
        );
        if (!isApproved) {
          violations.push(
            `Unverified qualitative claim: "${term}" used outside statutory exceptions in: "${sentence.trim()}"`
          );
        }
      }
    }
  }

  const coordinatePattern =
    /\b[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)\b/;
  const hemispherePattern = /\b\d{1,3}(?:\.\d+)?\s*[NSEW]\b/;
  if (coordinatePattern.test(narrativeText) || hemispherePattern.test(narrativeText)) {
    violations.push(
      'Direct geographic coordinate pattern detected in narrative. Map geometries must remain Resolver-exclusive.'
    );
  }

  const extractedNumbers = extractNormalizedNumbers(narrativeText);
  const allowedNumbersSet = normalizeNumberList(resolverOutput.extractedFacts.allowedNumbers);
  for (const num of extractedNumbers) {
    if (!allowedNumbersSet.has(normalizeNumericToken(num))) {
      violations.push(
        `Unauthorized numeric value: "${num}". Not present in ground-truth facts.`
      );
    }
  }

  const groundedNumeric = new Set(
    [...resolverOutput.extractedFacts.allowedNumbers, ...resolverOutput.extractedFacts.allowedGluedNumbers].map(normalizeNumericToken)
  );
  for (const glued of extractGluedNumbers(narrativeText)) {
    if (!groundedNumeric.has(normalizeNumericToken(glued))) {
      violations.push(
        `Unverified glued numeric value: "${glued}". Not present in ground-truth facts.`
      );
    }
  }

  // PWSID check: digit runs glued to letters (e.g. NY7003493) never match
  // the numeric extractors above, so a spoofed PWSID would otherwise pass.
  // Any PWSID-like token must equal the Resolver PWSID exactly.
  const pwsidPattern = /\b[A-Z]{2}\d[A-Z0-9]*\b/g;
  const expectedPwsid = (resolverOutput.schematic.pwsid ?? '').toUpperCase();
  const seenPwsids = new Set<string>();
  let pwsidMatch: RegExpExecArray | null;
  while ((pwsidMatch = pwsidPattern.exec(narrativeText)) !== null) {
    const token = pwsidMatch[0].toUpperCase();
    if (seenPwsids.has(token)) continue;
    seenPwsids.add(token);
    if (expectedPwsid === 'UNKNOWN' || token !== expectedPwsid) {
      violations.push(
        `Unverified water system identifier: "${pwsidMatch[0]}". Not the ground-truth PWSID ${resolverOutput.schematic.pwsid}.`
      );
    }
  }

  const allowedEntitiesSet: Set<string> = new Set(
    resolverOutput.extractedFacts.allowedEntities.map((e: string) =>
      e.toLowerCase().trim()
    )
  );

  for (const pattern of ENTITY_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(narrativeText)) !== null) {
      if (match[1]) {
        const candidate = match[1].toLowerCase().trim();
        if (['the', 'a', 'an', 'this', 'water'].includes(candidate)) continue;
        const allowedList: string[] = Array.from(allowedEntitiesSet);
        if (!entityAllowed(candidate, allowedList)) {
          violations.push(
            `Unverified water entity or parameter claimed: "${candidate}".`
          );
        }
      }
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}
