// lib/nldi.ts — USGS NLDI upstream + basin + WQP pre-treatment context.
// Live host only: https://api.water.usgs.gov/nldi (labs.waterdata.usgs.gov is
// retired; NWIS WaterServices is closing Nov 2026-Feb 2027, never use it).
// No key, 8s timeout, fail-soft, schematic only: intake coordinates are never
// published, so the summary carries counts + characteristic names, never geometry.
// WQP rows are pre-treatment context, never tap results.
import type { UpstreamSummary } from '../types/water-intelligence.js';
import { EchoError } from './echo.js';

export interface NldiClientOptions {
  fetchJson?: (url: string, init?: { signal: AbortSignal }) => Promise<unknown>;
  now?: () => string;
  timeoutMs?: number;
}

const NLDI = 'https://api.water.usgs.gov/nldi';

async function getJson(
  url: string,
  fetchJson: (url: string, init?: { signal: AbortSignal }) => Promise<unknown>,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await Promise.race([
      fetchJson(url, { signal: controller.signal }),
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          controller.abort();
          reject(new EchoError(`Timed out after ${timeoutMs}ms`, 'timeout'));
        }, timeoutMs),
      ),
    ]).catch((err: unknown) => {
      if ((err as Error)?.name === 'AbortError') throw new EchoError(`Timed out after ${timeoutMs}ms`, 'timeout');
      throw err;
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Upstream + WQP summary for an approximate outlet point.
 * Outlet is a representative basin point, never an intake coordinate.
 */
export async function fetchUpstreamSummary(
  outletLon: number,
  outletLat: number,
  outletLabel: string,
  options: NldiClientOptions = {},
): Promise<UpstreamSummary> {
  const {
    fetchJson = async (url: string, init?: { signal: AbortSignal }) => {
      const res = await fetch(url, { signal: init?.signal });
      if (!res.ok) throw new EchoError(`NLDI fetch failed: HTTP ${res.status}`, 'bad_response');
      return (await res.json()) as unknown;
    },
    now = () => new Date().toISOString(),
    timeoutMs = 8000,
  } = options;
  if (!Number.isFinite(outletLon) || !Number.isFinite(outletLat)) {
    throw new EchoError('NLDI outlet must be finite numbers', 'bad_response');
  }
  const capture = now();
  // 1. Upstream flowlines (UT navigation) from the outlet comid lookup.
  // Keep it light: linked-data comid + UT head, count features only.
  const comidUrl = `${NLDI}/comid/position?coords=POINT(${outletLon}%20${outletLat})&f=json`;
  const comidRaw = (await getJson(comidUrl, fetchJson, timeoutMs)) as {
    comid?: unknown;
  } | null;
  const comid = typeof comidRaw?.comid === 'number' ? comidRaw.comid : null;
  let upstreamCount = 0;
  if (comid !== null) {
    const utUrl = `${NLDI}/comid/${comid}/navigation/UT/flowlines?f=json&distance=50`;
    const utRaw = (await getJson(utUrl, fetchJson, timeoutMs)) as {
      features?: unknown[];
    } | null;
    upstreamCount = Array.isArray(utRaw?.features) ? Math.min(utRaw.features.length, 500) : 0;
  }
  // 2. WQP stations in the basin (pre-treatment context only).
  let stationCount = 0;
  const characteristics: string[] = [];
  if (comid !== null) {
    try {
      const wqpUrl = `${NLDI}/comid/${comid}/navigation/UT/wqp?f=json&distance=50`;
      const wqpRaw = (await getJson(wqpUrl, fetchJson, timeoutMs)) as {
        features?: Array<{ properties?: { stationname?: unknown; characteristicname?: unknown } }>;
      } | null;
      const feats = Array.isArray(wqpRaw?.features) ? wqpRaw.features : [];
      stationCount = Math.min(feats.length, 500);
      const seen = new Set<string>();
      for (const f of feats) {
        const c = typeof f?.properties?.characteristicname === 'string' ? f.properties.characteristicname.trim() : '';
        if (c && !seen.has(c.toLowerCase())) {
          seen.add(c.toLowerCase());
          characteristics.push(c.slice(0, 40));
        }
        if (characteristics.length >= 5) break;
      }
    } catch {
      // WQP is best-effort; upstream count still stands.
    }
  }
  return {
    outletLabel: outletLabel.slice(0, 80),
    upstreamCount,
    stationCount,
    characteristics,
    dataCaptureTime: capture,
    sourceUrl: 'https://api.water.usgs.gov/nldi',
    confidence: 'schematic',
  };
}
