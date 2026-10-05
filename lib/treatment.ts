// lib/treatment.ts — reported treatment profile (descriptive, never a grade).
// Pulls SDWIS TREATMENT process phrases (Envirofacts efservice, verified
// contract) and composes a plain-English rigor label from observed processes
// plus the EPA source-water kind. No scores, no verdicts: filtration and
// disinfection are reported as observed facts.
import type { TreatmentProfile } from '../types/water-intelligence.js';
import { EchoError } from './echo.js';
import treatmentNyc from '../data/treatment-nyc.json' with { type: 'json' };

interface TreatmentSnapshot {
  snapshotVersion: string;
  captureTime: string;
  pwsid: string;
  processes: string[];
}

const FIXTURES: Record<string, TreatmentSnapshot> = {
  NY7003493: treatmentNyc as unknown as TreatmentSnapshot,
};

/** Curated fixture, if any. */
export function readTreatmentFixture(pwsid: string, now: string = new Date().toISOString()): TreatmentProfile | null {
  const snap = FIXTURES[pwsid];
  if (!snap) return null;
  return {
    pwsid,
    processes: [...new Set(snap.processes.map((p) => p.trim()).filter(Boolean))].slice(0, 8),
    rigor: null,
    dataCaptureTime: snap.captureTime,
  };
}

export interface TreatmentClientOptions {
  fetchJson?: (url: string, init?: { signal: AbortSignal }) => Promise<unknown>;
  now?: () => string;
  timeoutMs?: number;
  maxRows?: number;
}

interface EfTreatmentRow {
  comments_text?: unknown;
}

/** Live pull of reported treatment processes for a PWSID. */
export async function fetchTreatment(
  pwsid: string,
  options: TreatmentClientOptions = {},
): Promise<TreatmentProfile> {
  const {
    fetchJson = async (url: string, init?: { signal: AbortSignal }) => {
      const res = await fetch(url, { signal: init?.signal });
      if (!res.ok) throw new EchoError(`SDWIS fetch failed: HTTP ${res.status}`, 'bad_response');
      return (await res.json()) as unknown;
    },
    now = () => new Date().toISOString(),
    timeoutMs = 8000,
    maxRows = 200,
  } = options;

  if (!/^[A-Z]{2}[A-Z0-9]*\d[A-Z0-9]*$/.test(pwsid)) {
    throw new EchoError(`Refusing to query SDWIS with a non-PWSID value: ${pwsid}`, 'bad_response');
  }
  const url =
    `https://data.epa.gov/efservice/TREATMENT/PWSID/=/${encodeURIComponent(pwsid)}` +
    `/rows/0:${Math.max(1, Math.min(maxRows, 1000))}/JSON`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let raw: unknown;
  try {
    raw = await Promise.race([
      fetchJson(url, { signal: controller.signal }),
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          controller.abort();
          reject(new EchoError(`Timed out after ${timeoutMs}ms`, 'timeout'));
        }, timeoutMs),
      ),
    ]).catch((err: unknown) => {
      if ((err as Error)?.name === 'AbortError') {
        throw new EchoError(`Timed out after ${timeoutMs}ms`, 'timeout');
      }
      throw err;
    });
  } catch (err) {
    if (err instanceof EchoError) throw err;
    throw new EchoError(`SDWIS fetch failed: ${(err as Error).message}`, 'network');
  } finally {
    clearTimeout(timer);
  }
  if (!Array.isArray(raw)) {
    throw new EchoError(`SDWIS response for ${pwsid} was not an array`, 'bad_response');
  }
  const seen = new Set<string>();
  for (const row of raw as EfTreatmentRow[]) {
    const text = typeof row?.comments_text === 'string' ? row.comments_text.trim().toUpperCase() : '';
    if (text) seen.add(text);
    if (seen.size >= 8) break;
  }
  return { pwsid, processes: [...seen], rigor: null, dataCaptureTime: now() };
}

/**
 * Compose a rigor label from observed process phrases + source-water kind.
 * Returns null when the evidence is too thin to say anything honest.
 */
export function describeTreatment(
  processes: string[],
  sourceKind?: 'groundwater' | 'surface' | 'unknown',
): string | null {
  const text = processes.join(' ').toUpperCase();
  if (!text.trim()) return null;
  const filtered = /FILTR|FILTER|MICROFILTR|ULTRAFILTR|NANOFILTR|REVERSE OSMOSIS/.test(text);
  const disinfected = /CHLOR|UV|ULTRAVIOLET|OZONE|CHLORAMINE|DISINFECT/.test(text);
  if (!filtered && !disinfected) return null;
  const how = filtered ? 'Filtered' : sourceKind === 'surface' ? 'Unfiltered' : null;
  const what =
    sourceKind === 'groundwater' ? 'groundwater' : sourceKind === 'surface' ? 'surface water' : null;
  if (how && what) return disinfected ? `${how} ${what}, disinfected` : `${how} ${what}`;
  if (what) return disinfected ? `Disinfected ${what}` : null;
  if (how) return disinfected ? `${how}, disinfected` : how;
  return disinfected ? 'Disinfected' : null;
}
