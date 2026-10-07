// lib/lcr.ts — Lead/Copper 90th-percentile snapshots (LCR, descriptive only).
// Fixture: data/lcr-nyc.json (currently empty placeholder). Live: efservice
// LCR_SAMPLE_RESULT/PWSID (no key, 8s, fail-soft). Reported percentiles
// against action levels only; never a safety verdict.
import type { QualityMetricRecord } from '../types/water-intelligence.js';
import { EchoError } from './echo.js';
import lcrNyc from '../data/lcr-nyc.json' with { type: 'json' };

interface LcrSnapshot {
  snapshotVersion: string;
  captureTime: string;
  sourceDocumentUrl: string;
  reportPeriod: string;
  pwsid: string;
  metrics: Array<{
    parameter: string;
    reportedValue: string;
    regulatoryThreshold: string;
    complianceStatus: QualityMetricRecord['complianceStatus'];
    testDate: string;
  }>;
}

const REGISTRY: Record<string, LcrSnapshot> = {
  NY7003493: lcrNyc as unknown as LcrSnapshot,
};

export function loadLcrMetrics(pwsid: string): QualityMetricRecord[] {
  const snap = REGISTRY[pwsid];
  if (!snap) return [];
  return snap.metrics.map((m) => ({
    parameter: m.parameter,
    reportedValue: m.reportedValue,
    regulatoryThreshold: m.regulatoryThreshold,
    complianceStatus: m.complianceStatus,
    testDate: m.testDate,
    provenance: {
      sourceDocumentUrl: snap.sourceDocumentUrl,
      reportPeriod: snap.reportPeriod,
      captureTime: snap.captureTime,
      sourceVersionId: snap.snapshotVersion,
    },
  }));
}

export interface LcrClientOptions {
  fetchJson?: (url: string, init?: { signal: AbortSignal }) => Promise<unknown>;
  now?: () => string;
  timeoutMs?: number;
  maxRows?: number;
}

/** Live pull: best-effort 90th-percentile rows (PB90/CU90 columns vary by state extract). */
export async function fetchLcrMetrics(
  pwsid: string,
  options: LcrClientOptions = {},
): Promise<QualityMetricRecord[]> {
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
    `https://data.epa.gov/efservice/LCR_SAMPLE_RESULT/PWSID/=/${encodeURIComponent(pwsid)}` +
    `/rows/0:${Math.max(1, Math.min(maxRows, 1000))}/JSON`;
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
    if (!Array.isArray(raw)) throw new EchoError(`SDWIS response for ${pwsid} was not an array`, 'bad_response');
    const out: QualityMetricRecord[] = [];
    const capture = now();
    for (const r of raw as Record<string, unknown>[]) {
      if (!r || typeof r !== 'object') continue;
      const param = String(r.contaminant ?? r.CONTAMINANT ?? r.analyte ?? '').trim();
      if (!/lead|copper|pb90|cu90/i.test(param)) continue;
      const val = String(r.ninetieth_percentile ?? r.PB90 ?? r.CU90 ?? r.result ?? '').trim();
      if (!val) continue;
      const isLead = /lead|pb90/i.test(param);
      out.push({
        parameter: isLead ? 'Lead 90th percentile' : 'Copper 90th percentile',
        reportedValue: val.slice(0, 40),
        regulatoryThreshold: isLead ? '15 ppb action level' : '1.3 ppm action level',
        complianceStatus: 'monitoring_violation',
        testDate: String(r.sample_date ?? r.SAMPLE_DATE ?? capture.slice(0, 10)).slice(0, 10),
        provenance: {
          sourceDocumentUrl: `https://data.epa.gov/efservice/LCR_SAMPLE_RESULT/PWSID/=/${encodeURIComponent(pwsid)}/JSON`,
          reportPeriod: 'LCR monitoring',
          captureTime: capture,
          sourceVersionId: `efservice-lcr-${capture.slice(0, 10)}`,
        },
      });
      if (out.length >= 2) break;
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}
