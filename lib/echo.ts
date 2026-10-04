// lib/echo.ts — EPA SDWIS compliance client (Closes #2).
// Fetch is injectable so CI runs on recorded fixtures, never live calls.
import type { SdwisComplianceProfile } from '../types/water-intelligence.js';

export const ECHO_QUERY_WINDOW = {
  startDate: '2021-01-01',
  endDate: '2026-01-01',
} as const;

export function echoReportUrl(pwsid: string): string {
  return `https://echo.epa.gov/detailed-facility-report?fid=${encodeURIComponent(pwsid)}`;
}

export class EchoError extends Error {
  constructor(
    message: string,
    public readonly kind: 'network' | 'bad_response' | 'timeout',
  ) {
    super(message);
    this.name = 'EchoError';
  }
}

interface EchoSnapshotShape {
  pwsid: string;
  totalViolationsFound: number;
  records: SdwisComplianceProfile['records'];
  captureTime?: string;
}

export interface EchoClientOptions {
  /** Overrideable data URL; defaults to the versioned local snapshot. */
  sourceUrl?: string;
  fetchJson?: (url: string) => Promise<unknown>;
  now?: () => string;
  timeoutMs?: number;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new EchoError(`Timed out after ${ms}ms`, 'timeout')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Load the SDWIS compliance window for a PWSID.
 * Zero violations is data ("no records found in window"), never a verdict.
 */
export async function fetchEchoCompliance(
  pwsid: string,
  options: EchoClientOptions = {},
): Promise<SdwisComplianceProfile> {
  const {
    sourceUrl = new URL('../data/echo-nyc.json', import.meta.url).href,
    fetchJson = async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new EchoError(`ECHO fetch failed: HTTP ${res.status}`, 'bad_response');
      return (await res.json()) as unknown;
    },
    now = () => new Date().toISOString(),
    timeoutMs = 8000,
  } = options;

  let raw: unknown;
  try {
    raw = await withTimeout(fetchJson(sourceUrl), timeoutMs);
  } catch (err) {
    if (err instanceof EchoError) throw err;
    throw new EchoError(`ECHO fetch failed: ${(err as Error).message}`, 'network');
  }
  const snap = raw as EchoSnapshotShape;
  if (!snap || typeof snap !== 'object' || snap.pwsid !== pwsid || !Array.isArray(snap.records)) {
    throw new EchoError(`ECHO response did not match PWSID ${pwsid}`, 'bad_response');
  }
  return {
    pwsid,
    queryWindow: { ...ECHO_QUERY_WINDOW },
    totalViolationsFound: snap.totalViolationsFound,
    records: snap.records,
    echoReportUrl: echoReportUrl(pwsid),
    dataCaptureTime: snap.captureTime ?? now(),
  };
}
