// lib/geo.ts — deterministic PWSID resolver (Closes #1).
// Point-in-polygon over a versioned EPA Service Area snapshot. No network.
import type { BoundaryConfidence } from '../types/water-intelligence.js';
import areaSnapshot from '../data/epa-service-area.json' with { type: 'json' };

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

const SNAPSHOT = areaSnapshot as unknown as AreaSnapshot;

export function snapshotVersion(): string {
  return SNAPSHOT.snapshotVersion;
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

/**
 * Resolve a coordinate to its public water system.
 * Accepts an injectable service-area collection (defaults to the bundled
 * snapshot). Outside every known polygon returns an explicit unverified
 * fallback — never a guessed PWSID.
 */
export function resolveSystem(lat: number, lon: number, areas: ServiceArea[] = SNAPSHOT.systems): ResolvedSystem {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return {
      pwsid: 'UNKNOWN',
      systemName: 'Unserved by showcase snapshot',
      boundaryType: 'unverified_fallback',
      primaryBasins: [],
    };
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
  return {
    pwsid: 'UNKNOWN',
    systemName: 'Unserved by showcase snapshot',
    boundaryType: 'unverified_fallback',
    primaryBasins: [],
  };
}
