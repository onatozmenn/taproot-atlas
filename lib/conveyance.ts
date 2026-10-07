// lib/conveyance.ts — vendored large conveyances (aqueduct/canal/pipeline).
// OSM Overpass is unreliable live, so representative labels are vendored from
// utility pages + OSM tags (man_made=pipeline, waterway=canal). Schematic only,
// never engineering alignments.
import type { ConveyanceRecord } from '../types/water-intelligence.js';
import conveyances from '../data/conveyances.json' with { type: 'json' };

interface ConveyanceSnapshot {
  snapshotVersion: string;
  captureTime: string;
  systems: Record<string, ConveyanceRecord[]>;
}

const SNAP = conveyances as unknown as ConveyanceSnapshot;

/** Schematic conveyance labels for a PWSID (max 4). */
export function loadConveyances(pwsid: string): ConveyanceRecord[] {
  const rows = SNAP.systems[pwsid];
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && typeof r.name === 'string' && r.name.trim().length > 0)
    .slice(0, 4)
    .map((r) => ({ name: r.name.slice(0, 80), substance: 'water', confidence: 'schematic' as const }));
}
