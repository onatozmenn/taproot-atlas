// Live data-service: calls the deterministic core pipeline (snapshot-backed,
// no network) and shapes ValidatedApiResponse for the chat UI.
import { answerTapWater } from '../../lib/pipeline';
import type {
  QualityMetricRecord,
  ValidatedApiResponse,
} from '../../types/water-intelligence';

export interface TapAnswer {
  systemName: string;
  pwsid: string;
  boundaryType: 'VERIFIED_AGENCY' | 'MODELED_EPA' | 'UNVERIFIED_FALLBACK';
  /** water = full report; redirect = slim off-topic deflection, no map/cards. */
  scope: 'water' | 'redirect';
  /** True when compliance has no curated snapshot yet (verify live at ECHO). */
  compliancePending: boolean;
  /** Nearest OSM drinking-water points (UNKNOWN areas, best effort). */
  nearbyPoints: Array<{ name: string; distanceM: number; osmUrl: string; lat?: number; lon?: number }>;
  /** Reported treatment profile, when available. */
  treatment: { rigor: string | null; processes: string[] } | null;
  /** Compliance tier for the window (descriptive, never a verdict). */
  recordTier: 'unknown-pending' | 'none-found' | 'monitoring-only' | 'health-based' | 'other';
  basins: string[];
  overview: string;
  /** Redirect call-to-action lines (metricsSummary + complianceNote); empty for water scope. */
  details: string;
  flow: Array<{ label: string; role: string; at: [number, number] }>;
  metrics: QualityMetricRecord[];
  windowStart: string;
  windowEnd: string;
  violations: number;
  echoUrl: string;
  verifiedAt: string;
  disclaimer: string;
  passedAudit: boolean;
  auditTimestamp: string;
  recordSource: 'snapshot_fixture' | 'live_fetch';
  narrator: 'llm' | 'template';
  jev: 'pass' | 'flag' | 'skipped';
}

function toTapAnswer(res: ValidatedApiResponse): TapAnswer {
  const g = res.groundTruth;
  return {
    systemName: g.systemName,
    pwsid: g.pwsid,
    boundaryType: g.boundaryType.toUpperCase() as TapAnswer['boundaryType'],
    scope: res.scope ?? 'water',
    compliancePending: res.groundTruth.regulatoryCompliance.snapshotPending === true,
    nearbyPoints: (res.groundTruth.nearbyDrinkingPoints ?? []).map((p) => ({
      name: p.name,
      distanceM: p.distanceM,
      osmUrl: p.osmUrl,
      ...(typeof p.lat === 'number' && typeof p.lon === 'number' ? { lat: p.lat, lon: p.lon } : {}),
    })),
    treatment: res.groundTruth.treatment
      ? { rigor: res.groundTruth.treatment.rigor, processes: res.groundTruth.treatment.processes }
      : null,
    recordTier: res.groundTruth.regulatoryCompliance.snapshotPending
      ? 'unknown-pending'
      : res.groundTruth.regulatoryCompliance.totalViolationsFound === 0
        ? 'none-found'
        : res.groundTruth.regulatoryCompliance.records.some((r) => r.violationType === 'health_based')
          ? 'health-based'
          : res.groundTruth.regulatoryCompliance.records.some((r) => r.violationType === 'other')
            ? 'other'
            : 'monitoring-only',
    basins: g.primaryBasins,
    overview: res.narrative.overview,
    details: [res.narrative.metricsSummary, res.narrative.complianceNote]
      .filter((p) => p && p.trim().length > 0)
      .join('\n\n'),
    flow: g.schematicFlow.features.flatMap((f) => {
      if (f.geometry.type !== 'Point') return [];
      const [lon, lat] = f.geometry.coordinates;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
      return [{ label: f.properties.label, role: f.properties.role, at: [lon, lat] as [number, number] }];
    }),
    metrics: g.latestReportedMetrics,
    windowStart: g.regulatoryCompliance.queryWindow.startDate,
    windowEnd: g.regulatoryCompliance.queryWindow.endDate,
    violations: g.regulatoryCompliance.totalViolationsFound,
    echoUrl: g.regulatoryCompliance.echoReportUrl,
    verifiedAt: g.regulatoryCompliance.dataCaptureTime,
    disclaimer: g.disclaimer,
    passedAudit: res.validationStatus.passedLlmAudit,
    auditTimestamp: res.validationStatus.auditTimestamp,
    recordSource: res.validationStatus.recordSource,
    narrator: res.validationStatus.narrator,
    jev: res.validationStatus.jev,
  };
}

export async function askTapWater(
  question: string,
  opts: { lat?: number; lon?: number; signal?: AbortSignal } = {},
): Promise<TapAnswer> {
  const q = question.slice(0, 2000);
  const hasCoords =
    typeof opts.lat === 'number' &&
    typeof opts.lon === 'number' &&
    Number.isFinite(opts.lat) &&
    Number.isFinite(opts.lon);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const onExternalAbort = () => controller.abort();
    opts.signal?.addEventListener('abort', onExternalAbort);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q, ...(hasCoords ? { lat: opts.lat, lon: opts.lon } : {}) }),
        signal: controller.signal,
      });
      if (res.ok) return toTapAnswer((await res.json()) as ValidatedApiResponse);
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onExternalAbort);
    }
  } catch {
    // Preview/dev without functions, offline, or aborted: fall back to local pipeline.
    opts.signal?.throwIfAborted();
  }
  opts.signal?.throwIfAborted();
  return toTapAnswer(await answerTapWater({ question: q, ...(hasCoords ? { lat: opts.lat, lon: opts.lon } : {}) }));
}
