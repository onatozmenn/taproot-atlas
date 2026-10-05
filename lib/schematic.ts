// lib/schematic.ts — schematic flow GeoJSON builder (Closes #5).
// Every feature is isApproximate: true. These geometries give map context;
// they never depict operational engineering alignments.
import type { GeoJsonGeometry } from '../types/water-intelligence.js';

export type FlowRole = 'watershed' | 'treatment_facility' | 'distribution_zone';

export interface FlowNode {
  label: string;
  role: FlowRole;
  /** Representative (approximate) map point as [lon, lat]. */
  at: [number, number];
}

export interface SchematicFlow {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: GeoJsonGeometry;
    properties: { label: string; role: FlowRole; isApproximate: boolean };
  }>;
  /** Travels with the geometry so serialized consumers never lose the notice. */
  disclaimer: string;
}

export const SCHEMATIC_DISCLAIMER =
  'Flow paths and boundaries are schematic approximations for orientation only; they do not depict operational engineering alignments.';

/** Showcase nodes: Catskill/Delaware watersheds → treatment → NYC tap zone.
 * Unknown basin names are skipped (never fabricated, never thrown) so the
 * pipeline always returns a 200 fallback instead of a 502. */
export function showcaseNodes(basins: string[]): FlowNode[] {
  const watershedAt: Record<string, [number, number]> = {
    Catskill: [-74.3, 42.0],
    Delaware: [-75.2, 41.7],
  };
  const known = basins.filter((b) => b in watershedAt);
  return [
    ...known.map((b) => ({
      label: `${b} Watershed`,
      role: 'watershed' as FlowRole,
      at: watershedAt[b],
    })),
    { label: 'Treatment Facility', role: 'treatment_facility' as FlowRole, at: [-73.9, 40.9] },
    { label: 'Distribution Zone', role: 'distribution_zone' as FlowRole, at: [-73.97, 40.78] },
  ];
}

export function buildSchematicFlow(nodes: FlowNode[]): SchematicFlow {
  return {
    type: 'FeatureCollection',
    disclaimer: SCHEMATIC_DISCLAIMER,
    features: nodes.map((n) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: n.at },
      properties: { label: n.label, role: n.role, isApproximate: true },
    })),
  };
}
