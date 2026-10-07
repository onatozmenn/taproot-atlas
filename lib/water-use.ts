// lib/water-use.ts — USGS modeled public-supply SW/GW split loader.
// Ratios come from county/HUC12 withdrawal modeling (2000-2020), never meter
// readings. Always rendered with the Modeled label.
import type { WaterUseSplit } from '../types/water-intelligence.js';
import waterUse from '../data/water-use.json' with { type: 'json' };

interface WaterUseSnapshot {
  snapshotVersion: string;
  captureTime: string;
  sourceUrl: string;
  systems: Record<string, { surfacePct: number; groundPct: number; referencePeriod: string }>;
}

const SNAP = waterUse as unknown as WaterUseSnapshot;

/** Modeled SW/GW split for a PWSID, if vendored. */
export function loadWaterUse(pwsid: string): WaterUseSplit | null {
  const row = SNAP.systems[pwsid];
  if (!row) return null;
  if (!Number.isFinite(row.surfacePct) || !Number.isFinite(row.groundPct)) return null;
  return {
    surfacePct: row.surfacePct,
    groundPct: row.groundPct,
    referencePeriod: row.referencePeriod,
    dataCaptureTime: SNAP.captureTime,
    sourceUrl: SNAP.sourceUrl,
    confidence: 'modeled',
  };
}
