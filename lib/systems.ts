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
  utilityUrl: string;
  reportUrl: string;
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
 */
export function findSystemByText(question: string): DirectorySystem | null {
  const q = (question ?? '').toLowerCase();
  let best: DirectorySystem | null = null;
  let bestLen = 0;
  for (const system of SNAPSHOT.systems) {
    for (const alias of system.aliases) {
      const a = alias.toLowerCase();
      if (a.length >= 3 && q.includes(a) && a.length > bestLen) {
        best = system;
        bestLen = a.length;
      }
    }
  }
  return best;
}
