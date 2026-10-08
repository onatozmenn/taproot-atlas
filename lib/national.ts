// lib/national.ts — nationwide coverage: every active US community water
// system serving 3,300+ people (about 9,700 systems, ~93% of the population
// on community systems), sharded by state and loaded lazily.
//   data/national/index.json        system index (name, city, state, pop, areas)
//   data/national/<ST>.json.gz      SDWIS profiles for that primacy agency
//   data/national/<ST>.occ.json.gz  SYR4 + UCMR5 lab summaries
//   data/national/places.json       Census 2024 gazetteer places + ZCTAs
// Files are read with fs on first use (never bundled into the client).
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
function candidates(): string[] {
  const list = [path.resolve(here, '../data/national'), path.resolve(here, '../../data/national')];
  // `process` does not exist in the browser bundle; this module is only read there via stubs.
  if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
    list.push(path.resolve(process.cwd(), 'data/national'));
  }
  return list;
}

let root: string | null | undefined;
export function nationalRoot(): string | null {
  if (root !== undefined) return root;
  root = candidates().find((c) => existsSync(path.join(c, 'index.json'))) ?? null;
  return root;
}

function readJson<T>(file: string): T | null {
  const r = nationalRoot();
  if (!r) return null;
  const full = path.join(r, file);
  if (!existsSync(full)) return null;
  try {
    const buf = readFileSync(full);
    const text = file.endsWith('.gz') ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export interface IndexRow {
  pwsid: string;
  name: string;
  addressCity: string;
  state: string;
  population: number;
  source: string;
  citiesServed: string[];
  counties: string[];
  zips: string[];
}

interface IndexFile {
  snapshotVersion: string;
  captureTime: string;
  columns: string[];
  rows: Array<[string, string, string, string, number, string, string[], string[], string[]]>;
}

let indexCache: IndexRow[] | null = null;
let indexMeta: { snapshotVersion: string; captureTime: string } | null = null;
export function nationalIndex(): IndexRow[] {
  if (indexCache) return indexCache;
  const f = readJson<IndexFile>('index.json');
  indexMeta = f ? { snapshotVersion: f.snapshotVersion, captureTime: f.captureTime } : null;
  indexCache = (f?.rows ?? []).map((r) => ({
    pwsid: r[0],
    name: r[1],
    addressCity: r[2],
    state: r[3],
    population: r[4],
    source: r[5],
    citiesServed: r[6],
    counties: r[7],
    zips: r[8],
  }));
  return indexCache;
}

export function nationalMeta() {
  nationalIndex();
  return indexMeta;
}

export function indexRow(pwsid: string): IndexRow | null {
  return nationalIndex().find((r) => r.pwsid === pwsid) ?? null;
}

const shardCache = new Map<string, Record<string, unknown> | null>();
/** Raw per-state shard (profiles or occurrence). */
export function stateShard<T>(st: string, kind: 'profiles' | 'occurrence'): { meta: Record<string, unknown>; systems: Record<string, T> } | null {
  const key = `${st}|${kind}`;
  if (!shardCache.has(key)) {
    const f = readJson<Record<string, unknown>>(kind === 'profiles' ? `${st}.json.gz` : `${st}.occ.json.gz`);
    shardCache.set(key, f);
  }
  const f = shardCache.get(key);
  if (!f) return null;
  const { systems, ...meta } = f as { systems: Record<string, T> };
  return { meta, systems };
}

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------

interface PlacesFile {
  commonWordPlaces?: string[];
  places: Array<[string, string, number, number]>;
  zips: Record<string, [number, number]>;
}
let placesCache: PlacesFile | null | undefined;
let normPlaces: Array<[string, string, string, number, number]> | null = null;
function places(): PlacesFile | null {
  if (placesCache === undefined) {
    placesCache = readJson<PlacesFile>('places.json');
    normPlaces = (placesCache?.places ?? []).map(([n, st, lat, lon]) => [n, norm(n), st, lat, lon]);
  }
  return placesCache ?? null;
}

export const STATE_NAMES: Record<string, string> = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california', CO: 'colorado', CT: 'connecticut',
  DE: 'delaware', DC: 'district of columbia', FL: 'florida', GA: 'georgia', HI: 'hawaii', ID: 'idaho', IL: 'illinois',
  IN: 'indiana', IA: 'iowa', KS: 'kansas', KY: 'kentucky', LA: 'louisiana', ME: 'maine', MD: 'maryland',
  MA: 'massachusetts', MI: 'michigan', MN: 'minnesota', MS: 'mississippi', MO: 'missouri', MT: 'montana',
  NE: 'nebraska', NV: 'nevada', NH: 'new hampshire', NJ: 'new jersey', NM: 'new mexico', NY: 'new york',
  NC: 'north carolina', ND: 'north dakota', OH: 'ohio', OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania',
  RI: 'rhode island', SC: 'south carolina', SD: 'south dakota', TN: 'tennessee', TX: 'texas', UT: 'utah',
  VT: 'vermont', VA: 'virginia', WA: 'washington', WV: 'west virginia', WI: 'wisconsin', WY: 'wyoming', PR: 'puerto rico',
};

/** Words that look like places but are almost always ordinary English here. */
const STOP_PLACES = new Set([
  'water', 'lead', 'tap', 'safe', 'clean', 'city', 'town', 'home', 'drinking', 'quality', 'source', 'fluoride',
  'nitrate', 'arsenic', 'copper', 'radium', 'chlorine', 'violations', 'violation', 'compliance', 'treatment',
  'pipes', 'pipe', 'plant', 'report', 'reports', 'filter', 'boil', 'hard', 'soft',
]);


const STATE_VALUES = new Set(Object.values(STATE_NAMES));

function norm(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\bst\.?\s/g, 'saint ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface PlaceHit {
  name: string;
  state: string;
  lat: number;
  lon: number;
  /** True when the question also named the state. */
  stateNamed: boolean;
}

/** Find the most specific US place named in free text ("Flint, MI", "phoenix"). */
export function findPlaceInText(text: string): PlaceHit | null {
  const p = places();
  if (!p) return null;
  const q = ` ${norm(text)} `;
  const raw = ` ${text} `;
  // State hint: postal code after a comma ("Flint, MI") or a full state name.
  const states = new Set<string>();
  for (const m of raw.matchAll(/,\s*([A-Z]{2})\b/g)) states.add(m[1]);
  for (const [code, name] of Object.entries(STATE_NAMES)) if (q.includes(` ${name} `)) states.add(code);
  const common = new Set(p.commonWordPlaces ?? []);
  let best: { hit: PlaceHit; score: number } | null = null;
  for (const [name, n, st, lat, lon] of normPlaces ?? []) {
    if (n.length < 3 || STOP_PLACES.has(n) || STATE_VALUES.has(n)) continue;
    if (!q.includes(` ${n} `)) continue;
    // "york" inside "new york", "virginia" inside "west virginia".
    if ([...STATE_VALUES].some((sv) => sv !== n && sv.includes(n) && q.includes(` ${sv} `))) continue;
    // A state name alone ("new york", "washington") is not a city unless it is the whole place.
    const stateNamed = states.has(st);
    if (states.size > 0 && !stateNamed) continue;
    if (!stateNamed && common.has(n)) {
      // Everyday word ("tell", "okay"): only as a capitalized proper noun,
      // or when a large system (50k+) serves a place by that name.
      const capitalized = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);
      if (!capitalized && !bigPlace(n)) continue;
    }
    const score = n.length * 10 + (stateNamed ? 5 : 0);
    if (!best || score > best.score) best = { hit: { name, state: st, lat, lon, stateNamed }, score };
  }
  return best?.hit ?? null;
}

export function nearestPlaces(lat: number, lon: number, k: number): Array<{ name: string; state: string; lat: number; lon: number }> {
  places();
  const cos = Math.cos((lat * Math.PI) / 180);
  return (normPlaces ?? [])
    .map(([name, , st, plat, plon]) => ({ name, state: st, lat: plat, lon: plon, d: (plat - lat) ** 2 + ((plon - lon) * cos) ** 2 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k);
}

const bigCache = new Map<string, boolean>();
function bigPlace(n: string): boolean {
  if (!bigCache.has(n)) bigCache.set(n, systemsForPlace(n, null).some((r) => r.population >= 50000));
  return bigCache.get(n)!;
}

export function zipCenter(zip: string): [number, number] | null {
  const z = places()?.zips[zip];
  return z ? [z[1], z[0]] : null;
}

/** Same-name places across states (for "Springfield" style ambiguity). */
export function placesNamed(name: string): Array<{ state: string; lat: number; lon: number }> {
  const p = places();
  if (!p) return [];
  const n = norm(name);
  return p.places.filter((x) => norm(x[0]) === n).map((x) => ({ state: x[1], lat: x[2], lon: x[3] }));
}

/**
 * Systems serving a named place, largest population first. Matches the
 * SDWIS city-served list, the utility mailing city, and the system name.
 */
export function systemsForPlace(name: string, state: string | null): IndexRow[] {
  const n = norm(name);
  const re = new RegExp(`(^| )${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`);
  return nationalIndex()
    .filter((r) => (state ? r.state === state || r.pwsid.startsWith(state) : true))
    .map((r) => {
      let score = 0;
      if (r.citiesServed.some((c) => norm(c) === n)) score += 3;
      if (re.test(norm(r.name))) score += 2;
      if (norm(r.addressCity) === n) score += 1;
      return { r, score };
    })
    .filter((x) => x.score > 0)
    // Population dominates (Tucson Water over a prison system that lists
    // Tucson), with a boost when the system is named for the place.
    .sort((a, b) => b.r.population * (1 + b.score) - a.r.population * (1 + a.score))
    .map((x) => x.r);
}

/** Systems serving a ZIP code (SDWIS zip-served list), largest first. */
export function systemsForZip(zip: string): IndexRow[] {
  return nationalIndex()
    .filter((r) => r.zips.includes(zip))
    .sort((a, b) => b.population - a.population);
}

/** Approximate map center for a system: its served ZIPs' centroid, else null. */
export function systemCenter(row: IndexRow): [number, number] | null {
  const pts = row.zips.map(zipCenter).filter((x): x is [number, number] => Boolean(x));
  if (pts.length === 0) return null;
  const lon = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const lat = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return [Math.round(lon * 1000) / 1000, Math.round(lat * 1000) / 1000];
}

export interface NationalHit {
  row: IndexRow;
  /** Place as the user named it ("Phoenix"), or the ZIP. */
  label: string;
  /** [lon, lat] of the place (Census internal point) or the system's ZIP centroid. */
  center: [number, number] | null;
  /** Same-named places in other states that also have a system ("Phoenix, OR"). */
  alternatives: string[];
}

/** Resolve a free-text question to the largest system serving the place or ZIP it names. */
export function resolveNationalSystem(question: string): NationalHit | null {
  if (nationalIndex().length === 0) return null;
  const zip = (question ?? '').match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zip) {
    const rows = systemsForZip(zip[1]);
    if (rows.length > 0) return { row: rows[0], label: `ZIP ${zip[1]}`, center: zipCenter(zip[1]) ?? systemCenter(rows[0]), alternatives: [] };
  }
  if (zip) {
    // SDWIS rarely lists served ZIPs: fall back to the nearest places to
    // the ZIP centroid that have a system.
    const c = zipCenter(zip[1]);
    if (c) {
      const near = nearestPlaces(c[1], c[0], 8);
      for (const pl of near) {
        const rows = systemsForPlace(pl.name, pl.state);
        if (rows.length > 0) return { row: rows[0], label: pl.name, center: c, alternatives: [] };
      }
    }
  }
  const place = findPlaceInText(question);
  if (!place) return null;
  if (place.stateNamed) {
    const rows = systemsForPlace(place.name, place.state);
    if (rows.length === 0) return null;
    return { row: rows[0], label: place.name, center: [place.lon, place.lat], alternatives: [] };
  }
  const options = placesNamed(place.name)
    .map((p) => ({ p, row: systemsForPlace(place.name, p.state)[0] }))
    .filter((x): x is { p: { state: string; lat: number; lon: number }; row: IndexRow } => Boolean(x.row))
    .sort((a, b) => b.row.population - a.row.population);
  if (options.length === 0) return null;
  const top = options[0];
  return {
    row: top.row,
    label: place.name,
    center: [top.p.lon, top.p.lat],
    alternatives: options.slice(1, 4).map((o) => `${place.name}, ${o.p.state}`),
  };
}
