// lib/osm.ts — public drinking-water fallback outside the showcase (Closes #4).
// Overpass API lookup for amenity=drinking_water. Always unverified_fallback:
// the UI must never show a Verified badge for these points.
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

/** Client-side cap applied AFTER distance sorting, so the closest points win. */
export const MAX_RESULTS = 20;

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
  // Ask for a superset; the closest MAX_RESULTS are picked after sorting.
  return `[out:json][timeout:10];node["amenity"="drinking_water"](around:${radiusM},${lat},${lon});out 100;`;
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
  fetchJson?: (url: string, body: string, init?: { signal: AbortSignal }) => Promise<unknown>;
  timeoutMs?: number;
}

/** Nearest public drinking-water points; empty array is a valid (honest) answer. */
export async function findDrinkingPoints(
  lat: number,
  lon: number,
  options: OsmClientOptions = {},
): Promise<DrinkingPoint[]> {
  const {
    fetchJson = async (url: string, body: string, init?: { signal: AbortSignal }) => {
      const res = await fetch(url, { method: 'POST', body, signal: init?.signal });
      if (res.status === 429) throw new OsmError('Overpass rate limit reached', 'rate_limited');
      if (!res.ok) throw new OsmError(`Overpass fetch failed: HTTP ${res.status}`, 'bad_response');
      return (await res.json()) as unknown;
    },
    timeoutMs = 12000,
  } = options;

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onTimeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new OsmError(`Timed out after ${timeoutMs}ms`, 'timeout'));
    }, timeoutMs);
  });
  let raw: unknown;
  try {
    raw = await Promise.race([
      fetchJson(OVERPASS_URL, overpassQuery(lat, lon), { signal: controller.signal }),
      onTimeout,
    ]).catch((err: unknown) => {
      if ((err as Error)?.name === 'AbortError') {
        throw new OsmError(`Timed out after ${timeoutMs}ms`, 'timeout');
      }
      throw err;
    });
  } catch (err) {
    if (err instanceof OsmError) throw err;
    throw new OsmError(`Overpass fetch failed: ${(err as Error).message}`, 'network');
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!raw || typeof raw !== 'object') {
    throw new OsmError('Overpass response was not an object', 'bad_response');
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
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, MAX_RESULTS);
}
