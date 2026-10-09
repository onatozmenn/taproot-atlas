// lib/triage.ts — the utility / regulator view of Taproot's forecast.
// Turns the per-system forecast into a priority queue: where should the next
// inspection, technical-assistance visit or dollar go? Rows are precomputed by
// scripts/risk/triage_build.py into data/national/triage.json.gz (forecast,
// EPA Enforcement Targeting Tool score, county social vulnerability, the
// suggested first step). Nothing here is a verdict on anyone's tap water.
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { STATE_NAMES } from './national.js';

export type TriageAction = 'monitoring' | 'lead' | 'dbp' | 'micro' | 'chem' | 'deficiency' | 'surface' | 'enforcement' | 'watch';

export interface TriageRow {
  id: string;
  n: string;
  st: string;
  c: string;
  pop: number;
  p: number;
  pct: number;
  ett: number;
  hb5: number;
  mr1: number;
  open: number;
  svi: number | null;
  src: 'S' | 'G';
  a: TriageAction;
  d: string[];
  dv: Array<number | null>;
  dd: Array<'up' | 'down'>;
  dl: string[];
}

export interface TriageMeta {
  year: number;
  base_rate: number;
  actions: Record<TriageAction, string>;
  curve: { share_visited: number[]; model: number[]; ett: number[]; repeat: number[]; years: string };
  fairness: Array<{ svi: string; base_rate: number; recall_top10: number; flag_rate: number; systems: number }>;
  svi_source: string;
  ett_note: string;
}

export interface TriageQuery {
  state?: string;
  action?: TriageAction;
  /** Only systems in counties in the top quarter of social vulnerability. */
  vulnerable?: boolean;
  /** Only systems EPA's targeting score does not already flag (ETT < 11). */
  hidden?: boolean;
  minPop?: number;
  limit?: number;
}

export interface TriageResult {
  meta: TriageMeta;
  state: string | null;
  stateName: string | null;
  /** Systems matching the filters (before the limit). */
  matched: number;
  /** All scored systems in scope (state or nation). */
  inScope: number;
  /** Forecast count of new health-based violations in scope next year (sum of p). */
  expected: number;
  summary: {
    flagged: number;
    flaggedPeople: number;
    notOnEttList: number;
    vulnerable: number;
  };
  rows: TriageRow[];
}

/** High-attention threshold: the national top 10% cut-off. */
let cache: { meta: TriageMeta; rows: TriageRow[]; top10: number } | null | undefined;

function load() {
  if (cache !== undefined) return cache;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, '../data/national/triage.json.gz'), path.resolve(here, '../../data/national/triage.json.gz')];
  if (typeof process !== 'undefined' && typeof process.cwd === 'function') candidates.push(path.resolve(process.cwd(), 'data/national/triage.json.gz'));
  const file = candidates.find((f) => existsSync(f));
  try {
    if (!file) return (cache = null);
    const raw = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')) as { meta: TriageMeta; rows: TriageRow[] };
    for (const r of raw.rows) r.c = (r.c ?? '').replace(/\s*\([A-Z]{1,3}\)\s*$/, '').trim();
    const sorted = [...raw.rows].sort((a, b) => b.p - a.p);
    const top10 = sorted[Math.max(0, Math.floor(sorted.length * 0.1) - 1)]?.p ?? 1;
    cache = { meta: raw.meta, rows: sorted, top10 };
  } catch {
    cache = null;
  }
  return cache;
}

export const VULNERABLE_SVI = 0.75;
export const ETT_PRIORITY = 11;

export function triageAvailable(): boolean {
  return load() !== null;
}

export function triage(q: TriageQuery = {}): TriageResult | null {
  const f = load();
  if (!f) return null;
  const st = q.state && STATE_NAMES[q.state.toUpperCase()] ? q.state.toUpperCase() : null;
  const scope = st ? f.rows.filter((r) => r.st === st) : f.rows;
  const flaggedRows = scope.filter((r) => r.p >= f.top10);
  let rows = scope;
  if (q.action) rows = rows.filter((r) => r.a === q.action);
  if (q.vulnerable) rows = rows.filter((r) => (r.svi ?? 0) >= VULNERABLE_SVI);
  if (q.hidden) rows = rows.filter((r) => r.ett < ETT_PRIORITY);
  if (q.minPop) rows = rows.filter((r) => r.pop >= q.minPop!);
  const limit = Math.max(1, Math.min(500, q.limit ?? 50));
  const nm = st ? STATE_NAMES[st] : null;
  return {
    meta: f.meta,
    state: st,
    stateName: nm ? nm.replace(/\b[a-z]/g, (c) => c.toUpperCase()) : null,
    matched: rows.length,
    inScope: scope.length,
    expected: Math.round(scope.reduce((a, r) => a + r.p, 0) * 10) / 10,
    summary: {
      flagged: flaggedRows.length,
      flaggedPeople: flaggedRows.reduce((a, r) => a + (r.pop || 0), 0),
      notOnEttList: flaggedRows.filter((r) => r.ett < ETT_PRIORITY).length,
      vulnerable: flaggedRows.filter((r) => (r.svi ?? 0) >= VULNERABLE_SVI).length,
    },
    rows: rows.slice(0, limit),
  };
}

/** Postal code for a state named in free text ("in Ohio", "OH systems"), or null. */
export function stateInText(text: string): string | null {
  const q = ` ${text.toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ')} `;
  let best: string | null = null;
  let bestLen = 0;
  for (const [code, name] of Object.entries(STATE_NAMES)) {
    if (q.includes(` ${name} `) && name.length > bestLen) {
      best = code;
      bestLen = name.length;
    }
  }
  if (best) return best;
  const m = text.match(/\b(?:in|for|across)\s+([A-Z]{2})\b/) ?? text.match(/\b([A-Z]{2})\s+(?:systems|utilities|water systems)\b/);
  return m && STATE_NAMES[m[1]] ? m[1] : null;
}

/** "Which systems in Ohio are most at risk?", "where should Texas inspect first?" */
export const TRIAGE_ASK_RE =
  /\b(most at[- ]risk|highest[- ]risk|riskiest|at[- ]risk (?:water )?systems|which (?:water )?(?:systems|utilities)|prioriti[sz]e|triage|priority (?:list|queue)|where should (?:we|i|the state|[a-z]+) (?:inspect|visit|send|fund|invest|look)|inspect first)\b/i;
