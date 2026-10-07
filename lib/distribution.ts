// lib/distribution.ts — NYC distribution monitoring via Socrata (bkwf-xfky).
// Live: https://data.cityofnewyork.us/resource/bkwf-xfky.json?$limit=N (no key,
// 8s timeout, fail-soft). Fixture path stays empty until a curated pull is
// vendored; runtime prefers live rows and falls back to loadDistributionMetrics.
import type { QualityMetricRecord } from '../types/water-intelligence.js';
import { EchoError } from './echo.js';

export interface DistributionClientOptions {
  fetchJson?: (url: string, init?: { signal: AbortSignal }) => Promise<unknown>;
  now?: () => string;
  timeoutMs?: number;
  limit?: number;
}

const RESOURCE = 'https://data.cityofnewyork.us/resource/bkwf-xfky.json';

/** Live pull: maps Socrata rows to reported distribution samples (max 4). */
export async function fetchDistributionMetrics(
  pwsid: string,
  options: DistributionClientOptions = {},
): Promise<QualityMetricRecord[]> {
  const {
    fetchJson = async (url: string, init?: { signal: AbortSignal }) => {
      const res = await fetch(url, { signal: init?.signal });
      if (!res.ok) throw new EchoError(`Socrata fetch failed: HTTP ${res.status}`, 'bad_response');
      return (await res.json()) as unknown;
    },
    now = () => new Date().toISOString(),
    timeoutMs = 8000,
    limit = 5,
  } = options;
  if (pwsid !== 'NY7003493') return [];
  const url = `${RESOURCE}?$limit=${Math.max(1, Math.min(limit, 20))}&$order=sample_date DESC`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const raw = (await Promise.race([
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
    })) as unknown;
    if (!Array.isArray(raw)) throw new EchoError('Socrata response was not an array', 'bad_response');
    const capture = now();
    const out: QualityMetricRecord[] = [];
    for (const r of raw as Record<string, unknown>[]) {
      if (!r || typeof r !== 'object') continue;
      const param = String(r.parameter ?? r.analyte ?? r.test ?? '').trim() || 'Distribution sample';
      const val = String(r.result ?? r.value ?? r.measurement ?? '').trim();
      if (!val) continue;
      const date = String(r.sample_date ?? r.date ?? capture.slice(0, 10)).slice(0, 10);
      out.push({
        parameter: param.slice(0, 60),
        reportedValue: val.slice(0, 40),
        regulatoryThreshold: 'see CCR standard',
        complianceStatus: 'monitoring_violation',
        testDate: /^\d{4}-\d{2}-\d{2}/.test(date) ? date : capture.slice(0, 10),
        provenance: {
          sourceDocumentUrl: 'https://data.cityofnewyork.us/resource/bkwf-xfky.json',
          reportPeriod: 'Distribution monitoring',
          captureTime: capture,
          sourceVersionId: `socrata-bkwf-xfky-${capture.slice(0, 10)}`,
        },
      });
      if (out.length >= 4) break;
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}
