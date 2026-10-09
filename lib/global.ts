// lib/global.ts — Taproot outside the United States.
//
// Taproot's forecast needs three records per water system: a registry row
// (who it serves, from what source), its results against the limits
// (violations/exceedances), and what the regulator did (inspections,
// directions, enforcement). This module defines that minimum as the
// "Open Water Record", the readiness of a few regulators that already publish
// it, and a working adapter for Ireland's EPA Remedial Action List
// (data/global/ie-ral-2025q4.json, parsed from the EPA/Uisce Éireann PDF by
// scripts/global/ie_ral.py).

import { readFileSync } from 'node:fs';
import path from 'node:path';

export type OwrReason =
  | 'cryptosporidium'
  | 'disinfection'
  | 'ecoli'
  | 'thm'
  | 'pesticides'
  | 'hse'
  | 'aluminium'
  | 'turbidity'
  | 'audit';

/** The minimum a regulator publishes for Taproot to rank its systems. */
export interface OpenWaterRecord {
  country: string; // ISO 3166-1 alpha-2
  systemId: string; // regulator's own code (PWSID, scheme code, zone id)
  name: string;
  region: string; // state / county / local authority
  population: number;
  source?: 'surface' | 'ground' | 'mixed' | 'purchased';
  /** Health-limit failures or treatment failures, newest first. */
  exceedances: Array<{ date: string; parameter: string; value?: number; limit?: number; unit?: string }>;
  /** Inspections, directions, enforcement and regulator watch-lists. */
  actions: Array<{ date: string; kind: 'inspection' | 'direction' | 'enforcement' | 'watchlist'; reasons?: OwrReason[]; note?: string }>;
}

export const REASON_LABEL: Record<OwrReason, string> = {
  cryptosporidium: 'no barrier to Cryptosporidium',
  disinfection: 'inadequate disinfection',
  ecoli: 'E. coli / enterococci failures',
  thm: 'disinfection byproducts (THMs) over the limit',
  pesticides: 'pesticides over the limit',
  hse: 'flagged by the health service',
  aluminium: 'excess aluminium',
  turbidity: 'poor turbidity removal',
  audit: 'treatment and management problems found in an EPA audit',
};

export interface IrelandRalRow {
  code: string;
  county: string;
  name: string;
  pop: number;
  reasons: OwrReason[];
}

let ralCache: IrelandRalRow[] | null = null;
export function irelandRal(): IrelandRalRow[] {
  if (!ralCache) {
    try {
      const p = path.resolve(process.cwd(), 'data/global/ie-ral-2025q4.json');
      ralCache = JSON.parse(readFileSync(p, 'utf8')) as IrelandRalRow[];
    } catch {
      return []; // browser offline fallback: no file system
    }
  }
  return ralCache;
}

/** Ireland's at-risk list as Open Water Records (watch-list action, end of 2025). */
export function irelandRecords(rows = irelandRal()): OpenWaterRecord[] {
  return rows.map((r) => ({
    country: 'IE',
    systemId: r.code,
    name: r.name,
    region: `Co. ${r.county}`,
    population: r.pop,
    exceedances: [],
    actions: [{ date: '2025-12-31', kind: 'watchlist', reasons: r.reasons, note: 'EPA Remedial Action List Q4 2025' }],
  }));
}

/** Structural check used by adapters and tests. Returns a list of problems. */
export function validateRecord(r: OpenWaterRecord): string[] {
  const out: string[] = [];
  if (!/^[A-Z]{2}$/.test(r.country)) out.push('country must be ISO alpha-2');
  if (!r.systemId) out.push('systemId missing');
  if (!r.name) out.push('name missing');
  if (!(r.population >= 0)) out.push('population must be ≥ 0');
  for (const a of r.actions) if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) out.push(`bad action date ${a.date}`);
  for (const e of r.exceedances) if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) out.push(`bad exceedance date ${e.date}`);
  return out;
}

const IE_SOURCE = 'https://www.epa.ie/our-services/compliance--enforcement/drinking-water/remedial-action-list';
const fmt = (n: number) => n.toLocaleString('en-US');

/**
 * Chat answer for questions about Irish public water. Returns null when the
 * question is not about Ireland. Matches named supplies or counties on the
 * EPA's at-risk list; otherwise gives the national picture.
 */
export function irelandAnswer(question: string): { markdown: string; followUps: string[] } | null {
  if (!/\b(ireland|irish|éire|eire)\b/i.test(question)) return null;
  const rows = irelandRal();
  if (!rows.length) return null;
  const q = question.toLowerCase();
  const total = rows.reduce((a, r) => a + r.pop, 0);
  const bySupply = rows.filter((r) => q.includes(r.name.toLowerCase().replace(/\s*\(.*\)$/, '').replace(/ (pws|rws|regional)$/i, '').trim()));
  const counties = [...new Set(rows.map((r) => r.county))];
  const county = counties.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(question));
  const hits = bySupply.length ? bySupply : county ? rows.filter((r) => r.county === county) : [];
  const link = `[How Taproot travels](#/global)`;
  if (hits.length) {
    const top = [...hits].sort((a, b) => b.pop - a.pop).slice(0, 3);
    const lines = top.map((r) => `**${r.name}** (Co. ${r.county}, ${fmt(r.pop)} people): ${r.reasons.map((x) => REASON_LABEL[x]).join('; ') || 'listed for corrective action'}.`);
    const lead = bySupply.length
      ? `${hits.length === 1 ? 'This supply is' : 'These supplies are'} on Ireland’s EPA Remedial Action List, the regulator’s register of public supplies at risk.`
      : `Co. ${county} has ${hits.length} ${hits.length === 1 ? 'supply' : 'supplies'} on Ireland’s EPA Remedial Action List (end of 2025).`;
    return {
      markdown: `${lead}\n\n${lines.join('\n\n')}\n\nBeing on the list means Uisce Éireann must fix the treatment; it does not mean the water is unsafe today. ${link}`,
      followUps: ['Which Irish supplies are at risk?', 'How accurate is Taproot?'],
    };
  }
  return {
    markdown: `Ireland’s EPA lists ${rows.length} public supplies serving about ${fmt(Math.round(total / 1000) * 1000)} people as at risk at the end of 2025, mostly for disinfection byproducts, Cryptosporidium barriers and treatment problems. Name a county or supply and I’ll show what’s listed. ${link}`,
    followUps: ['Is Limerick water on the at-risk list in Ireland?', 'Which Irish supplies are at risk in Kerry, Ireland?'],
  };
}

export const IRELAND_SOURCE = IE_SOURCE;
