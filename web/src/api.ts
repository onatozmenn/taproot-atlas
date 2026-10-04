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
  basins: string[];
  overview: string;
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
}

function toTapAnswer(res: ValidatedApiResponse): TapAnswer {
  const g = res.groundTruth;
  return {
    systemName: g.systemName,
    pwsid: g.pwsid,
    boundaryType: g.boundaryType.toUpperCase() as TapAnswer['boundaryType'],
    basins: g.primaryBasins,
    overview: res.narrative.overview,
    flow: g.schematicFlow.features.map((f) => ({
      label: f.properties.label,
      role: f.properties.role,
      at: (f.geometry.type === 'Point' ? f.geometry.coordinates : [0, 0]) as [number, number],
    })),
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
  };
}

export async function askTapWater(question: string): Promise<TapAnswer> {
  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (res.ok) return toTapAnswer((await res.json()) as ValidatedApiResponse);
  } catch {
    // Preview/dev without functions, or offline: fall back to the local pipeline.
  }
  return toTapAnswer(await answerTapWater({ question }));
}
