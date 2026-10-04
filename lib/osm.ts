// lib/osm.ts — public drinking-water fallback outside the showcase (Closes #4).
// Overpass API lookup for amenity=drinking_water. Always unverified_fallback:
// the UI must never show a Verified badge for these points.
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export interface DrinkingPoint {
  name: string;
  lat: number;
  lon: number;
  distanceM: number;
  osmUrl: string;
}

export class OsmError extends Error {
  constructor(
    message: string,
    public readonly kind: 'network' | 'bad_response' | 'timeout' | 'rate_limited',
  ) {
    super(message);
    this.name = 'OsmError';
  }
}

export function overpassQuery(lat: number, lon: number, radiusM = 2000): string {
  return `[out:json][timeout:10];node["amenity"="drinking_water"](around:${radiusM},${lat},${lon});out 20;`;
}

function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

interface OverpassElement {
  id: number;
  lat: number;
  lon: number;
  tags?: { name?: string };
}

export interface OsmClientOptions {
  fetchJson?: (url: string, body: string) => Promise<unknown>;
  timeoutMs?: number;
}

/** Nearest public drinking-water points; empty array is a valid (honest) answer. */
export async function findDrinkingPoints(
  lat: number,
  lon: number,
  options: OsmClientOptions = {},
): Promise<DrinkingPoint[]> {
  const {
    fetchJson = async (url: string, body: string) => {
      const res = await fetch(url, { method: 'POST', body });
      if (res.status === 429) throw new OsmError('Overpass rate limit reached', 'rate_limited');
      if (!res.ok) throw new OsmError(`Overpass fetch failed: HTTP ${res.status}`, 'bad_response');
      return (await res.json()) as unknown;
    },
    timeoutMs = 12000,
  } = options;

  let raw: unknown;
  try {
    raw = await Promise.race([
      fetchJson(OVERPASS_URL, overpassQuery(lat, lon)),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new OsmError(`Timed out after ${timeoutMs}ms`, 'timeout')), timeoutMs),
      ),
    ]);
  } catch (err) {
    if (err instanceof OsmError) throw err;
    throw new OsmError(`Overpass fetch failed: ${(err as Error).message}`, 'network');
  }
  const elements = (raw as { elements?: OverpassElement[] }).elements;
  if (!Array.isArray(elements)) throw new OsmError('Overpass response had no elements', 'bad_response');
  return elements
    .filter((e) => typeof e.lat === 'number' && typeof e.lon === 'number')
    .map((e) => ({
      name: e.tags?.name ?? 'Public drinking water point',
      lat: e.lat,
      lon: e.lon,
      distanceM: Math.round(haversineM(lat, lon, e.lat, e.lon)),
      osmUrl: `https://www.openstreetmap.org/node/${e.id}`,
    }))
    .sort((a, b) => a.distanceM - b.distanceM);
}
