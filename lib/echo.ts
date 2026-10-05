// lib/echo.ts — EPA SDWIS compliance client.
// Two explicit paths: a bundled DEMONSTRATION FIXTURE for offline use
// (readSnapshotCompliance) and a network client for live ECHO wiring
// (fetchEchoCompliance, http(s) only — never file: URLs, always abortable).
import type { SdwisComplianceProfile } from '../types/water-intelligence.js';
import echoFixture from '../data/echo-nyc.json' with { type: 'json' };

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
  queryWindow: { startDate: string; endDate: string };
  totalViolationsFound: number;
  records: SdwisComplianceProfile['records'];
  captureTime?: string;
  sourceQueryUrl?: string;
}

function toProfile(
  pwsid: string,
  snap: EchoSnapshotShape,
  window: { startDate: string; endDate: string },
  now: string,
): SdwisComplianceProfile {
  if (!snap || typeof snap !== 'object') {
    throw new EchoError(`ECHO response for ${pwsid} was not an object`, 'bad_response');
  }
  if (snap.pwsid !== pwsid || !Array.isArray(snap.records)) {
    throw new EchoError(`ECHO response did not match PWSID ${pwsid}`, 'bad_response');
  }
  if (typeof snap.totalViolationsFound !== 'number' || !Number.isInteger(snap.totalViolationsFound)) {
    throw new EchoError(`ECHO response for ${pwsid} had no numeric violation count`, 'bad_response');
  }
  if (
    !snap.queryWindow ||
    snap.queryWindow.startDate !== window.startDate ||
    snap.queryWindow.endDate !== window.endDate
  ) {
    throw new EchoError(
      `ECHO response for ${pwsid} does not cover the requested window ${window.startDate} to ${window.endDate}`,
      'bad_response',
    );
  }
  return {
    pwsid,
    queryWindow: { ...window },
    totalViolationsFound: snap.totalViolationsFound,
    records: snap.records,
    echoReportUrl: snap.sourceQueryUrl ?? echoReportUrl(pwsid),
    dataCaptureTime: snap.captureTime ?? now,
  };
}

/**
 * Offline path: bundled demonstration fixture (see data/echo-nyc.json
 * provenanceNote). Safe in browsers; must be served behind a fixture label.
 */
export function readSnapshotCompliance(
  pwsid: string,
  window: { startDate: string; endDate: string } = { ...ECHO_QUERY_WINDOW },
  now: string = new Date().toISOString(),
): SdwisComplianceProfile {
  return toProfile(pwsid, echoFixture as unknown as EchoSnapshotShape, window, now);
}

/**
 * Honest empty state for curated directory systems with no snapshot yet.
 * totalViolationsFound stays 0 with snapshotPending: true — consumers must
 * never present it as "0 violations found"; the live ECHO profile owns
 * compliance until a snapshot is curated.
 */
export function pendingCompliance(
  pwsid: string,
  now: string = new Date().toISOString(),
): SdwisComplianceProfile {
  return {
    pwsid,
    queryWindow: { ...ECHO_QUERY_WINDOW },
    totalViolationsFound: 0,
    records: [],
    echoReportUrl: echoReportUrl(pwsid),
    dataCaptureTime: now,
    snapshotPending: true,
  };
}

export interface EchoClientOptions {
  /** Live ECHO endpoint returning the EchoSnapshotShape contract (documented in docs/DATA.md). */
  sourceUrl: string;
  fetchJson?: (url: string, init?: { signal: AbortSignal }) => Promise<unknown>;
  window?: { startDate: string; endDate: string };
  now?: () => string;
  timeoutMs?: number;
}

/**
 * Live path: fetch an ECHO SDWIS record and validate it before reporting.
 * Zero violations is data ("no records found in window"), never a verdict.
 */
export async function fetchEchoCompliance(
  pwsid: string,
  options: EchoClientOptions,
): Promise<SdwisComplianceProfile> {
  const {
    sourceUrl,
    fetchJson = async (url: string, init?: { signal: AbortSignal }) => {
      const res = await fetch(url, { signal: init?.signal });
      if (!res.ok) throw new EchoError(`ECHO fetch failed: HTTP ${res.status}`, 'bad_response');
      return (await res.json()) as unknown;
    },
    window = { ...ECHO_QUERY_WINDOW },
    now = () => new Date().toISOString(),
    timeoutMs = 8000,
  } = options;

  if (!/^https?:\/\//i.test(sourceUrl)) {
    throw new EchoError(`ECHO source must be an http(s) URL, got: ${sourceUrl}`, 'bad_response');
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onTimeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new EchoError(`Timed out after ${timeoutMs}ms`, 'timeout'));
    }, timeoutMs);
  });
  try {
    const raw = await Promise.race([fetchJson(sourceUrl, { signal: controller.signal }), onTimeout]).catch(
      (err: unknown) => {
        if ((err as Error)?.name === 'AbortError') {
          throw new EchoError(`Timed out after ${timeoutMs}ms`, 'timeout');
        }
        throw err;
      },
    );
    return toProfile(pwsid, raw as EchoSnapshotShape, window, now());
  } catch (err) {
    if (err instanceof EchoError) throw err;
    throw new EchoError(`ECHO fetch failed: ${(err as Error).message}`, 'network');
  } finally {
    if (timer) clearTimeout(timer);
  }
}
