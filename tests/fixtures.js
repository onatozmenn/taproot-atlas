// tests/fixtures.js — shared ground truth for deterministic tests.
export function mockSchematic() {
  return {
    pwsid: 'NY0023456',
    systemName: 'NYC DEP Catskill-Delaware',
    boundaryType: 'verified_agency',
    primaryBasins: ['Catskill', 'Delaware'],
    schematicFlow: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-74.0, 40.7] },
          properties: { label: 'Catskill Watershed', role: 'watershed', isApproximate: true },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-73.9, 40.75] },
          properties: { label: 'Distribution Zone', role: 'distribution_zone', isApproximate: true },
        },
      ],
    },
    regulatoryCompliance: {
      pwsid: 'NY0023456',
      queryWindow: { startDate: '2021-01-01', endDate: '2026-01-01' },
      totalViolationsFound: 0,
      records: [],
      echoReportUrl: 'https://echo.epa.gov/detailed-facility-report?fid=NY0023456',
      dataCaptureTime: '2026-01-02T00:00:00Z',
    },
    latestReportedMetrics: [
      {
        parameter: 'Turbidity',
        reportedValue: '0.08 NTU',
        regulatoryThreshold: '0.3 NTU TT',
        complianceStatus: 'within_standard',
        testDate: '2025-12-01',
        provenance: {
          sourceDocumentUrl: 'https://www.nyc.gov/site/dep/water/drinking-water.page',
          reportPeriod: '2025 Annual',
          captureTime: '2026-01-02T00:00:00Z',
          sourceVersionId: 'nyc-2025-v1',
        },
      },
      {
        parameter: 'Total Coliform',
        reportedValue: '0 positive samples',
        regulatoryThreshold: '5.0% positive TT',
        complianceStatus: 'within_standard',
        testDate: '2025-12-01',
        provenance: {
          sourceDocumentUrl: 'https://www.nyc.gov/site/dep/water/drinking-water.page',
          reportPeriod: '2025 Annual',
          captureTime: '2026-01-02T00:00:00Z',
          sourceVersionId: 'nyc-2025-v1',
        },
      },
    ],
    disclaimer:
      'Reported lab results and regulatory records only; not a real-time safety guarantee.',
  };
}
