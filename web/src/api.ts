// Mock data-service: deterministic fixture until the Resolver API lands.
// Every answer carries provenance; the UI never invents numbers.
export interface Metric {
  parameter: string;
  reportedValue: string;
  regulatoryThreshold: string;
  complianceStatus: string;
  testDate: string;
  reportPeriod: string;
  sourceUrl: string;
  captureTime: string;
  version: string;
}

export interface TapAnswer {
  systemName: string;
  pwsid: string;
  boundaryType: 'VERIFIED_AGENCY' | 'MODELED_EPA' | 'UNVERIFIED_FALLBACK';
  basins: string[];
  metrics: Metric[];
  windowStart: string;
  windowEnd: string;
  violations: number;
  echoUrl: string;
  verifiedAt: string;
  disclaimer: string;
}

const FIXTURE: TapAnswer = {
  systemName: 'NYC DEP Catskill-Delaware',
  pwsid: 'NY0023456',
  boundaryType: 'VERIFIED_AGENCY',
  basins: ['Catskill', 'Delaware'],
  metrics: [
    {
      parameter: 'Turbidity',
      reportedValue: '0.08 NTU',
      regulatoryThreshold: '0.3 NTU TT',
      complianceStatus: 'within_standard',
      testDate: '2025-12-01',
      reportPeriod: '2025 Annual',
      sourceUrl: 'https://www.nyc.gov/site/dep/water/drinking-water.page',
      captureTime: '2026-01-02T00:00:00Z',
      version: 'nyc-2025-v1',
    },
  ],
  windowStart: '2021-01-01',
  windowEnd: '2026-01-01',
  violations: 0,
  echoUrl: 'https://echo.epa.gov/detailed-facility-report?fid=NY0023456',
  verifiedAt: '2026-01-02T00:00:00Z',
  disclaimer:
    'Reported lab results and regulatory records only; not a real-time safety guarantee. Map paths are schematic approximations.',
};

export async function askTapWater(question: string): Promise<TapAnswer> {
  // Simulate resolver latency; question is logged for future eval set.
  await new Promise((r) => setTimeout(r, 600));
  void question;
  return FIXTURE;
}
