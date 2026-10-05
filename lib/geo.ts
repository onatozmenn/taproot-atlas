// lib/geo.ts — deterministic PWSID resolver.
// Point-in-polygon over the national EPA boundaries snapshot (rings per
// system) plus the legacy NYC borough extent. No network.
import type { BoundaryConfidence } from '../types/water-intelligence.js';
import areaSnapshot from '../data/epa-service-area.json' with { type: 'json' };
import boundariesSnapshot from '../data/us-boundaries.json' with { type: 'json' };
import { getDirectorySystem } from './systems.js';

export interface ServiceArea {
  pwsid: string;
  systemName: string;
  boundaryType: BoundaryConfidence;
  primaryBasins: string[];
  polygon: [number, number][];
}

export interface ResolvedSystem {
  pwsid: string;
  systemName: string;
  boundaryType: BoundaryConfidence;
  primaryBasins: string[];
}

interface AreaSnapshot {
  snapshotVersion: string;
  systems: ServiceArea[];
}

interface BoundariesSnapshot {
  snapshotVersion: string;
  systems: Array<{ pwsid: string; verificationStatus: string; rings: [number, number][][] }>;
}

const SNAPSHOT = areaSnapshot as unknown as AreaSnapshot;
const BOUNDARIES = boundariesSnapshot as unknown as BoundariesSnapshot;

export function snapshotVersion(): string {
  return SNAPSHOT.snapshotVersion;
}

export function boundariesVersion(): string {
  return BOUNDARIES.snapshotVersion;
}

export function listServiceAreas(): ServiceArea[] {
  return SNAPSHOT.systems;
}

/** Ray-casting point-in-polygon. Point is [lon, lat]. */
export function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Point inside any ring of a multipolygon boundary. */
export function pointInRings(point: [number, number], rings: [number, number][][]): boolean {
  return rings.some((ring) => pointInPolygon(point, ring));
}

function unknown(): ResolvedSystem {
  return {
    pwsid: 'UNKNOWN',
    systemName: 'Unserved by showcase snapshot',
    boundaryType: 'unverified_fallback',
    primaryBasins: [],
  };
}

/**
 * Resolve a coordinate against the national EPA boundary rings.
 * Verification_Status=Verified maps to verified_agency, any other matched
 * ring to modeled_epa. Basin names come from the curated directory when the
 * system is listed there. Null when no ring contains the point.
 */
export function resolveBoundary(
  lat: number,
  lon: number,
  boundaries: BoundariesSnapshot['systems'] = BOUNDARIES.systems,
): (ResolvedSystem & { verified: boolean }) | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  for (const entry of boundaries) {
    if (pointInRings([lon, lat], entry.rings)) {
      const verified = (entry.verificationStatus || '').trim() === 'Verified';
      const dir = getDirectorySystem(entry.pwsid);
      return {
        pwsid: entry.pwsid,
        systemName: dir?.systemName ?? entry.pwsid,
        boundaryType: verified ? 'verified_agency' : 'modeled_epa',
        primaryBasins: dir?.basins.map((b) => b.name) ?? [],
        verified,
      };
    }
  }
  return null;
}

/**
 * Resolve a coordinate to its public water system: national EPA rings first,
 * then the legacy borough extent. Outside everything returns an explicit
 * unverified fallback — never a guessed PWSID.
 */
export function resolveSystem(lat: number, lon: number, areas: ServiceArea[] = SNAPSHOT.systems): ResolvedSystem {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return unknown();
  const hit = resolveBoundary(lat, lon);
  if (hit) {
    const { verified: _verified, ...resolved } = hit;
    return resolved;
  }
  for (const area of areas) {
    if (pointInPolygon([lon, lat], area.polygon)) {
      return {
        pwsid: area.pwsid,
        systemName: area.systemName,
        boundaryType: area.boundaryType,
        primaryBasins: area.primaryBasins,
      };
    }
  }
  return unknown();
}
