// lib/occurrence.ts — build-time snapshot loaders (UCMR5, SYR4, distribution).
// Large zips (UCMR5, SYR4, CA DDW) are processed by scripts/pull-*.py into
// PWSID-filtered JSON snapshots; runtime only reads the vendored files.
// Occurrence rows are never MCL verdicts: UCMR prose must say "occurrence,
// no federal MCL" where applicable. All loaders are fail-soft (empty array).
import type { QualityMetricRecord } from '../types/water-intelligence.js';
import ucmrNyc from '../data/ucmr5-nyc.json' with { type: 'json' };
import ucmrTop10 from '../data/ucmr5.json' with { type: 'json' };
import syrNyc from '../data/syr4-nyc.json' with { type: 'json' };
import distNyc from '../data/distribution-nyc.json' with { type: 'json' };

interface OccurrenceSnapshot {
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

function toRecords(snap: OccurrenceSnapshot): QualityMetricRecord[] {
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

const UCMR: Record<string, OccurrenceSnapshot> = {
  NY7003493: ucmrNyc as unknown as OccurrenceSnapshot,
  ...((ucmrTop10 as unknown as Record<string, OccurrenceSnapshot>) ?? {}),
};
const SYR: Record<string, OccurrenceSnapshot> = {
  NY7003493: syrNyc as unknown as OccurrenceSnapshot,
};
const DIST: Record<string, OccurrenceSnapshot> = {
  NY7003493: distNyc as unknown as OccurrenceSnapshot,
};

/** UCMR5 occurrence (29 PFAS + lithium, 2023-2025). Empty until vendored. */
export function loadUcmrMetrics(pwsid: string): QualityMetricRecord[] {
  const snap = UCMR[pwsid];
  return snap ? toRecords(snap) : [];
}

/** SYR4 compliance-monitoring extracts (2012-2019). Empty until vendored. */
export function loadSyrMetrics(pwsid: string): QualityMetricRecord[] {
  const snap = SYR[pwsid];
  return snap ? toRecords(snap) : [];
}

/** Distribution-monitoring extracts (NYC Socrata bkwf-xfky shape). */
export function loadDistributionMetrics(pwsid: string): QualityMetricRecord[] {
  const snap = DIST[pwsid];
  return snap ? toRecords(snap) : [];
}
