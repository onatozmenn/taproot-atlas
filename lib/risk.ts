// lib/risk.ts — Taproot's forward-looking risk score.
// A LightGBM model trained on EPA SDWIS history (scripts/risk/*) estimates,
// for every community water system Taproot covers, the chance that a NEW
// health-based violation begins next calendar year. The scores and per-system
// SHAP drivers are precomputed into data/national/risk.json.gz; this module
// only reads them. It is a forecast from public records, never a measurement
// of anyone's tap water.
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { RiskDriver, RiskScore } from '../types/water-intelligence.js';
import { RISK_BINS, riskBin } from './risk-text.js';

interface RiskFile {
  meta: {
    target: string;
    features_as_of: string;
    base_rate: number;
    systems: number;
    model: string;
    backtest: Record<string, { model: { auc: number; recall_top10: number }; epa_ett: { recall_top10: number } }>;
  };
  systems: Record<string, { p: number; pct: number; drivers: RiskDriver[] }>;
}

/** Same words as the 'risk' topic in profile-answer.ts. */
export const RISK_ASK_RE =
  /\b(risk|risky|likely|likelihood|chances?|odds|probabilit\w*|predict\w*|forecast\w*|outlook|next year|in the future|going to (?:have|get)|will (?:it|they|there) (?:have|be|get))\b/i;

let cache: RiskFile | null | undefined;
let dist: number[] | null = null;

/** Count of scored systems per log-probability bin (see riskBin). */
export function riskDistribution(): number[] {
  if (dist) return dist;
  const f = load();
  const out = new Array(RISK_BINS).fill(0) as number[];
  if (f) for (const r of Object.values(f.systems)) out[riskBin(r.p)]++;
  dist = out;
  return out;
}

function load(): RiskFile | null {
  if (cache !== undefined) return cache;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, '../data/national/risk.json.gz'),
    path.resolve(here, '../../data/national/risk.json.gz'),
    path.resolve(process.cwd(), 'data/national/risk.json.gz'),
  ];
  const file = candidates.find((f) => existsSync(f));
  try {
    cache = file ? (JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')) as RiskFile) : null;
  } catch {
    cache = null;
  }
  return cache;
}

export function riskTier(p: number, base: number): RiskScore['tier'] {
  if (p >= 0.2) return 'high';
  if (p >= base * 1.5) return 'elevated';
  if (p >= base * 0.35) return 'typical';
  return 'low';
}

/** Backtest headline averaged over the held-out years. */
export function riskBacktest(): RiskScore['backtest'] | null {
  const f = load();
  if (!f) return null;
  const rows = Object.entries(f.meta.backtest);
  if (!rows.length) return null;
  const avg = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;
  const years = rows.map(([k]) => k.replace('predict_', '')).sort();
  return {
    modelRecallTop10: avg(rows.map(([, r]) => r.model.recall_top10)),
    ettRecallTop10: avg(rows.map(([, r]) => r.epa_ett.recall_top10)),
    auc: avg(rows.map(([, r]) => r.model.auc)),
    years: years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : years[0],
  };
}

export function riskFor(pwsid: string): RiskScore | null {
  const f = load();
  const r = f?.systems[pwsid];
  if (!f || !r) return null;
  const year = Number(f.meta.features_as_of.slice(0, 4)) + 1;
  return {
    probability: r.p,
    percentile: r.pct,
    year,
    baseRate: f.meta.base_rate,
    tier: riskTier(r.p, f.meta.base_rate),
    drivers: r.drivers,
    backtest: riskBacktest() ?? { modelRecallTop10: 0, ettRecallTop10: 0, auc: 0, years: '' },
    method: f.meta.model,
    distribution: riskDistribution(),
  };
}

/** All scored systems, highest forecast first (for the triage view). */
export function riskRanking(): Array<{ pwsid: string; p: number; pct: number; drivers: RiskDriver[] }> {
  const f = load();
  if (!f) return [];
  return Object.entries(f.systems)
    .map(([pwsid, r]) => ({ pwsid, ...r }))
    .sort((a, b) => b.p - a.p);
}

export { driverText } from './risk-text.js';
