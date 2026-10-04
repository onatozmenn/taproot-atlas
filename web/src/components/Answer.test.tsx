import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnswerCard } from './Answer';
import type { TapAnswer } from '../api';

const base: TapAnswer = {
  systemName: 'NYC DEP Catskill-Delaware',
  pwsid: 'NY7003493',
  boundaryType: 'MODELED_EPA',
  basins: ['Catskill', 'Delaware'],
  overview: 'Water for NYC DEP Catskill-Delaware (PWSID: NY7003493) is sourced from the Catskill and Delaware basins.',
  flow: [
    { label: 'Catskill Watershed', role: 'watershed', at: [-74.3, 42.0] as [number, number] },
    { label: 'Treatment', role: 'treatment_facility', at: [-73.9, 40.9] as [number, number] },
  ],
  metrics: [
    {
      parameter: 'Turbidity',
      reportedValue: '0.08 NTU',
      regulatoryThreshold: '0.3 NTU TT',
      complianceStatus: 'within_standard',
      testDate: '2024-12-01',
      provenance: {
        sourceDocumentUrl: 'https://www.nyc.gov/site/dep/water/drinking-water.page',
        reportPeriod: '2024 Annual',
        captureTime: '2026-01-02T00:00:00Z',
        sourceVersionId: 'nyc-2024-v1',
      },
    },
  ],
  windowStart: '2021-01-01',
  windowEnd: '2026-01-01',
  violations: 0,
  echoUrl: 'https://echo.epa.gov/detailed-facility-report?fid=NY7003493',
  verifiedAt: '2026-01-02T00:00:00Z',
  disclaimer: 'Reported lab results only.',
  passedAudit: true,
  auditTimestamp: '2026-01-02T00:00:01Z',
  recordSource: 'snapshot_fixture',
};

describe('AnswerCard', () => {
  it('renders metric provenance and the verified line', () => {
    render(<AnswerCard answer={base} />);
    expect(screen.getByText('Turbidity')).toBeInTheDocument();
    expect(screen.getByText(/2024 Annual/)).toBeInTheDocument();
    expect(screen.getByText('nyc-2024-v1')).toBeInTheDocument();
    expect(screen.getByText(/Verified summary/)).toBeInTheDocument();
    expect(screen.getByText('Modeled boundary')).toBeInTheDocument();
    expect(screen.getByText(/Demonstration snapshot/)).toBeInTheDocument();
  });

  it('renders the deterministic fallback line when audit fails', () => {
    render(<AnswerCard answer={{ ...base, passedAudit: false }} />);
    expect(screen.getByText(/Deterministic summary \(audit fallback\)/)).toBeInTheDocument();
  });

  it('never prints a safety verdict', () => {
    const { container } = render(<AnswerCard answer={base} />);
    const text = container.textContent?.toLowerCase() ?? '';
    for (const word of ['drinkable', 'pure', 'potable']) expect(text).not.toContain(word);
  });
});
