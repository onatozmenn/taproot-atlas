// lib/echo-live.ts — live EPA SDWIS compliance via Envirofacts efservice.
// Verified contract (no key, GET JSON): VIOLATION rows filtered by PWSID,
// window overlap on compl_per_begin/end dates. Absence of rows in the window
// is a real finding ("0 found in window"), not a fixture.
import type { SdwisComplianceProfile, SdwisViolationRecord } from '../types/water-intelligence.js';
import { ECHO_QUERY_WINDOW, echoReportUrl, EchoError } from './echo.js';

export interface LiveClientOptions {
  fetchJson?: (url: string, init?: { signal: AbortSignal }) => Promise<unknown>;
  window?: { startDate: string; endDate: string };
  now?: () => string;
  timeoutMs?: number;
  maxRows?: number;
}

interface EfViolationRow {
  violation_code?: unknown;
  violation_category_code?: unknown;
  is_health_based_ind?: unknown;
  compl_per_begin_date?: unknown;
  compl_per_end_date?: unknown;
  rtc_date?: unknown;
}

function toDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Row [begin, end ?? +inf) intersects the query window. */
function overlapsWindow(begin: string, end: string | null, window: { startDate: string; endDate: string }): boolean {
  return begin <= window.endDate && (end === null || end >= window.startDate);
}

function toRecord(row: EfViolationRow): SdwisViolationRecord | null {
  const begin = toDate(row.compl_per_begin_date);
  if (!begin) return null;
  const end = toDate(row.compl_per_end_date);
  const health = row.is_health_based_ind === 'Y';
  return {
    violationCode: String(row.violation_code ?? ''),
    violationType: health
      ? 'health_based'
      : row.violation_category_code === 'MR'
        ? 'monitoring_and_reporting'
        : 'other',
    beginDate: begin,
    endDate: end,
    complianceAchieved: row.rtc_date != null && String(row.rtc_date).length > 0,
  };
}

export async function fetchLiveCompliance(
  pwsid: string,
  options: LiveClientOptions = {},
): Promise<SdwisComplianceProfile> {
  const {
    fetchJson = async (url: string, init?: { signal: AbortSignal }) => {
      const res = await fetch(url, { signal: init?.signal });
      if (!res.ok) throw new EchoError(`SDWIS fetch failed: HTTP ${res.status}`, 'bad_response');
      return (await res.json()) as unknown;
    },
    window = { ...ECHO_QUERY_WINDOW },
    now = () => new Date().toISOString(),
    timeoutMs = 8000,
    maxRows = 1000,
  } = options;

  if (!/^[A-Z]{2}[A-Z0-9]*\d[A-Z0-9]*$/.test(pwsid)) {
    throw new EchoError(`Refusing to query SDWIS with a non-PWSID value: ${pwsid}`, 'bad_response');
  }
  const url =
    `https://data.epa.gov/efservice/VIOLATION/PWSID/=/${encodeURIComponent(pwsid)}` +
    `/rows/0:${Math.max(1, Math.min(maxRows, 5000))}/JSON`;

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
  const records: SdwisViolationRecord[] = [];
  for (const row of raw as EfViolationRow[]) {
    if (!row || typeof row !== 'object') {
      throw new EchoError(`SDWIS response for ${pwsid} contained a malformed row`, 'bad_response');
    }
    const record = toRecord(row);
    if (!record) continue;
    if (overlapsWindow(record.beginDate, record.endDate, window)) records.push(record);
  }
  records.sort((a, b) => (a.beginDate < b.beginDate ? 1 : a.beginDate > b.beginDate ? -1 : 0));
  return {
    pwsid,
    queryWindow: { ...window },
    totalViolationsFound: records.length,
    records,
    echoReportUrl: echoReportUrl(pwsid),
    dataCaptureTime: now(),
  };
}
