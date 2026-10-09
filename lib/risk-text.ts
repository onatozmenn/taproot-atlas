// lib/risk-text.ts — browser-safe helpers for the risk forecast (no node imports).
import type { RiskDriver } from '../types/water-intelligence.js';

/** Log-scale bins from 0.1% to 100% used by the forecast figure. */
export const RISK_BINS = 30;
export const RISK_MIN = 0.001;
export function riskPos(p: number): number {
  const x = Math.log10(Math.min(1, Math.max(RISK_MIN, p)));
  return (x - Math.log10(RISK_MIN)) / -Math.log10(RISK_MIN);
}
export function riskBin(p: number): number {
  return Math.min(RISK_BINS - 1, Math.floor(riskPos(p) * RISK_BINS));
}

/** Plain words for one driver ("42 missed tests or reports in 10 years"). */
export function driverText(d: RiskDriver): string {
  const v = d.value;
  switch (d.f) {
    case 'yrs_since_hb':
      return v === null || v >= 49 ? 'no health-based violation on record' : `last health-based violation ${Math.round(v)} year${Math.round(v) === 1 ? '' : 's'} ago`;
    case 'yrs_since_visit':
      return v === null || v >= 49 ? 'no state inspection on record' : `last state inspection ${Math.round(v)} years ago`;
    case 'log_pop':
      return v === null ? 'size of the system' : `serves about ${Math.round(10 ** v).toLocaleString('en-US')} people`;
    case 'log_conn':
      return v === null ? 'number of connections' : `about ${Math.round(10 ** v).toLocaleString('en-US')} service connections`;
    case 'src_surface':
      return v ? 'draws from surface water' : 'does not draw from surface water';
    case 'src_gwudi':
      return v ? 'groundwater influenced by surface water' : 'groundwater not under surface influence';
    case 'purchased':
      return v ? 'buys its water from another system' : 'treats its own water';
    case 'owner_private':
      return v ? 'privately owned' : 'publicly owned';
    case 'owner_local':
      return v ? 'run by local government' : 'not run by local government';
    case 'wholesaler':
      return v ? 'sells water to other systems' : 'does not sell water to other systems';
    case 'pb90_last':
    case 'pb90_max6':
    case 'pb90_trend':
      return v === null ? d.label : `${d.label.replace(/\s*\(ppb\)$/, '')}: ${Math.round(v * 10) / 10} ppb`;
    case 'mcl_ratio_max5':
      return v === null ? d.label : `worst result in 5 years was ${Math.round(v * 10) / 10}× its limit`;
    case 'ett':
      return `EPA enforcement-targeting score of ${v ?? 0}`;
    default:
      return v === null ? d.label : `${Number.isInteger(v) ? v : Math.round(v * 10) / 10} ${d.label}`;
  }
}
