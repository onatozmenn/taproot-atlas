// lib/systems.ts — curated US systems directory (Phase 1 multi-city).
// NYC resolves by coordinate polygon (lib/geo.ts). Other majors resolve by
// city-name match in the question, with honest unverified boundaries until
// agency polygons ship. Every PWSID/basin here is verified against an
// official source (see data/us-systems.json verificationSources).
import type { BoundaryConfidence } from '../types/water-intelligence.js';
import systemsSnapshot from '../data/us-systems.json' with { type: 'json' };

export interface DirectoryBasin {
  name: string;
  /** Representative approximate map point as [lon, lat]. */
  at: [number, number];
}

export interface DirectorySystem {
  pwsid: string;
  systemName: string;
  city: string;
  state: string;
  aliases: string[];
  center: [number, number];
  boundaryType: BoundaryConfidence;
  basins: DirectoryBasin[];
  /** Tier B entries (PWSID + city only) omit these until curated. */
  utilityUrl?: string;
  reportUrl?: string;
  populationServed?: number;
  /** EPA gw_sw_code: groundwater, surface, or unknown. */
  sourceKind?: 'groundwater' | 'surface' | 'unknown';
  metricsCurated: boolean;
}

interface SystemsSnapshot {
  snapshotVersion: string;
  captureTime: string;
  systems: DirectorySystem[];
}

const SNAPSHOT = systemsSnapshot as unknown as SystemsSnapshot;

export function systemsVersion(): string {
  return SNAPSHOT.snapshotVersion;
}

export function listDirectorySystems(): DirectorySystem[] {
  return SNAPSHOT.systems;
}

export function getDirectorySystem(pwsid: string): DirectorySystem | null {
  return SNAPSHOT.systems.find((s) => s.pwsid === pwsid) ?? null;
}

/**
 * Match a question against curated city aliases. Longest alias wins so
 * "new york city" beats "new york". Returns null when nothing matches.
 *
 * Ambiguous aliases (boston, chesterfield, kansas city, pittsburgh) never
 * resolve silently: without a state hint the match stays null so the
 * pipeline can ask for clarification instead of guessing a PWSID.
 */
export function findSystemByText(question: string): DirectorySystem | null {
  const candidates = findSystemCandidates(question);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  // Multiple systems share the same longest alias. A state hint
  // ("kansas city, kansas" vs "kansas city, missouri") disambiguates.
  // The alias itself is stripped first so "kansas" inside "kansas city"
  // is not mistaken for a Kansas state hint.
  const stated = extractStateHint(stripMatchedAlias(question, candidates));
  if (stated) {
    const filtered = candidates.filter((s) => s.state.toLowerCase() === stated);
    if (filtered.length === 1) return filtered[0];
    if (filtered.length > 1) return disambiguateSameState(filtered, question) ?? null;
    // State hint matches none of the tied candidates: stay ambiguous.
    return null;
  }
  return disambiguateSameState(candidates, question) ?? null;
}

/**
 * All systems tied for the longest alias match. Empty when nothing matches.
 * The pipeline uses this to detect ambiguity (same alias in several states
 * or cities) and ask for clarification instead of silently picking row one.
 */
export function findSystemCandidates(question: string): DirectorySystem[] {
  const q = (question ?? '').toLowerCase();
  let bestLen = 0;
  for (const system of SNAPSHOT.systems) {
    for (const alias of system.aliases) {
      const a = alias.toLowerCase();
      if (a.length >= 3 && q.includes(a) && a.length > bestLen) {
        bestLen = a.length;
      }
    }
  }
  if (bestLen === 0) return [];
  const out: DirectorySystem[] = [];
  for (const system of SNAPSHOT.systems) {
    for (const alias of system.aliases) {
      const a = alias.toLowerCase();
      if (a.length === bestLen && q.includes(a)) {
        out.push(system);
        break;
      }
    }
  }
  return out;
}

const STATE_NAMES: Record<string, string> = {
  al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas', ca: 'california',
  co: 'colorado', ct: 'connecticut', dc: 'district of columbia', de: 'delaware',
  fl: 'florida', ga: 'georgia', hi: 'hawaii', id: 'idaho', il: 'illinois',
  in: 'indiana', ia: 'iowa', ks: 'kansas', ky: 'kentucky', la: 'louisiana',
  me: 'maine', md: 'maryland', ma: 'massachusetts', mi: 'michigan',
  mn: 'minnesota', ms: 'mississippi', mo: 'missouri', mt: 'montana',
  ne: 'nebraska', nv: 'nevada', nh: 'new hampshire', nj: 'new jersey',
  nm: 'new mexico', ny: 'new york', nc: 'north carolina', nd: 'north dakota',
  oh: 'ohio', ok: 'oklahoma', or: 'oregon', pa: 'pennsylvania',
  ri: 'rhode island', sc: 'south carolina', sd: 'south dakota',
  tn: 'tennessee', tx: 'texas', ut: 'utah', vt: 'vermont', va: 'virginia',
  wa: 'washington', wv: 'west virginia', wi: 'wisconsin', wy: 'wyoming',
};

/** Two-letter state code hinted in the question, if any. */
function extractStateHint(question: string): string | null {
  const q = ` ${(question ?? '').toLowerCase()} `;
  // Full state names first ("kansas", "missouri", "virginia" ...).
  for (const [code, name] of Object.entries(STATE_NAMES)) {
    if (q.includes(` ${name} `) || q.includes(` ${name},`) || q.includes(` ${name}?`) || q.includes(` ${name}.`)) {
      return code;
    }
  }
  // Bare state codes as standalone words ("ks", "mo", "va" ...).
  for (const code of Object.keys(STATE_NAMES)) {
    if (new RegExp(`\\b${code}\\b`).test(q)) return code;
  }
  return null;
}

/** Remove the longest matched alias so its words are not mistaken for hints. */
function stripMatchedAlias(question: string, candidates: DirectorySystem[]): string {
  const q = (question ?? '').toLowerCase();
  let best = '';
  for (const s of candidates) {
    for (const alias of s.aliases) {
      const a = alias.toLowerCase();
      if (a.length >= 3 && q.includes(a) && a.length > best.length) best = a;
    }
  }
  if (!best) return question;
  const idx = q.indexOf(best);
  return `${question.slice(0, idx)} ${question.slice(idx + best.length)}`;
}

/**
 * Same-state ties (boston/MWRA vs boston/BWSC, pittsburgh/Elrama vs
 * pittsburgh/Pittsburgh): prefer the entry whose city is the alias itself.
 * Returns null when still tied so the caller asks for clarification.
 */
function disambiguateSameState(
  candidates: DirectorySystem[],
  question: string,
): DirectorySystem | null {
  const q = (question ?? '').toLowerCase();
  // Only safe when every candidate shares one state; cross-state ties
  // (kansas city MO/KS, chesterfield MO/VA) always need an explicit state.
  const states = new Set(candidates.map((s) => s.state.toLowerCase()));
  if (states.size !== 1) return null;
  // Find which alias actually matched, then prefer city === alias.
  let matchedAlias = '';
  let bestLen = 0;
  for (const s of candidates) {
    for (const alias of s.aliases) {
      const a = alias.toLowerCase();
      if (a.length >= 3 && q.includes(a) && a.length > bestLen) {
        bestLen = a.length;
        matchedAlias = a;
      }
    }
  }
  const exact = candidates.filter((s) => s.city.toLowerCase() === matchedAlias);
  if (exact.length === 1) return exact[0];
  return null;
}
