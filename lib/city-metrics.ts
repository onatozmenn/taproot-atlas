// lib/city-metrics.ts — versioned lab-metric snapshots keyed by PWSID.
// Each file mirrors data/nyc-2024.json: curated extracts of official annual
// water-quality reports with full provenance. Re-ingests ship a new
// sourceVersionId; history is never rewritten.
import type { QualityMetricRecord } from '../types/water-intelligence.js';
import nycSnapshot from '../data/nyc-2024.json' with { type: 'json' };
import chiSnapshot from '../data/chi-2025.json' with { type: 'json' };

interface MetricsSnapshot {
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

const REGISTRY: Record<string, MetricsSnapshot> = {
  NY7003493: nycSnapshot as unknown as MetricsSnapshot,
  IL0316000: chiSnapshot as unknown as MetricsSnapshot,
};

/** Curated PWSIDs with lab-metric snapshots. */
export function metricSnapshotPwsids(): string[] {
  return Object.keys(REGISTRY);
}

/** Ingest metrics for a PWSID; empty array when nothing is curated. */
export function loadCityMetrics(pwsid: string): QualityMetricRecord[] {
  const snapshot = REGISTRY[pwsid];
  if (!snapshot) return [];
  return snapshot.metrics.map((m) => ({
    parameter: m.parameter,
    reportedValue: m.reportedValue,
    regulatoryThreshold: m.regulatoryThreshold,
    complianceStatus: m.complianceStatus,
    testDate: m.testDate,
    provenance: {
      sourceDocumentUrl: snapshot.sourceDocumentUrl,
      reportPeriod: snapshot.reportPeriod,
      captureTime: snapshot.captureTime,
      sourceVersionId: snapshot.snapshotVersion,
    },
  }));
}
