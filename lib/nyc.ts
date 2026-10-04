// lib/nyc.ts — NYC DEP annual-report ingester (Closes #3).
// Turns the versioned snapshot into QualityMetricRecord[] with full provenance.
// Re-ingests never rewrite history: a new report ships a new sourceVersionId.
import type { QualityMetricRecord } from '../types/water-intelligence.js';
import nycSnapshot from '../data/nyc-2024.json' with { type: 'json' };

interface NycSnapshot {
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

const SNAPSHOT = nycSnapshot as unknown as NycSnapshot;

export function nycSnapshotVersion(): string {
  return SNAPSHOT.snapshotVersion;
}

export function nycReportPeriod(): string {
  return SNAPSHOT.reportPeriod;
}

/** Ingest metrics for a PWSID; empty array when the snapshot covers another system. */
export function ingestNycMetrics(pwsid: string): QualityMetricRecord[] {
  if (SNAPSHOT.pwsid !== pwsid) return [];
  return SNAPSHOT.metrics.map((m) => ({
    parameter: m.parameter,
    reportedValue: m.reportedValue,
    regulatoryThreshold: m.regulatoryThreshold,
    complianceStatus: m.complianceStatus,
    testDate: m.testDate,
    provenance: {
      sourceDocumentUrl: SNAPSHOT.sourceDocumentUrl,
      reportPeriod: SNAPSHOT.reportPeriod,
      captureTime: SNAPSHOT.captureTime,
      sourceVersionId: SNAPSHOT.snapshotVersion,
    },
  }));
}
