import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AnswerCard, SourcePanel } from './Answer';
import type { TapAnswer } from '../api';

afterEach(() => cleanup());

const base: TapAnswer = {
  systemName: 'NYC DEP Catskill-Delaware',
  pwsid: 'NY7003493',
  boundaryType: 'MODELED_EPA',
  scope: 'water',
  compliancePending: false,
  nearbyPoints: [],
  treatment: null,
  recordTier: 'none-found',
  basins: ['Catskill', 'Delaware'],
  overview: 'Water for NYC DEP Catskill-Delaware (PWSID: NY7003493) is sourced from the Catskill and Delaware basins.',
  details: '',
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
  narrator: 'template',
  jev: 'skipped',
};

describe('AnswerCard', () => {
  it('renders metric provenance with official record links', () => {
    render(<AnswerCard answer={base} />);
    expect(screen.getByText('Turbidity')).toBeInTheDocument();
    expect(screen.getByText(/2024 Annual/)).toBeInTheDocument();
    expect(screen.getByText('Within standard')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Verify Turbidity filing' })).toBeInTheDocument();
    expect(screen.getByText(/nyc-2024-v1/)).toBeInTheDocument();
    expect(screen.getByText(/2026-01-02T00:00:00Z/)).toBeInTheDocument();
  });

  it('exposes the ECHO compliance proofs behind the source toggle', () => {
    render(<SourcePanel answer={base} />);
    expect(screen.getByText('Access EPA ECHO system profile')).toBeInTheDocument();
    expect(screen.getByText(/Violations recorded/)).toBeInTheDocument();
  });

  it('hides internal audit and pipeline metadata from users', () => {
    const { container, queryByText } = render(<AnswerCard answer={base} />);
    expect(queryByText(/Verified summary/)).not.toBeInTheDocument();
    expect(queryByText(/Deterministic summary/)).not.toBeInTheDocument();
    expect(queryByText(/Demonstration snapshot/)).not.toBeInTheDocument();
    expect(queryByText(/JEV check/)).not.toBeInTheDocument();
    expect(queryByText(/audited /)).not.toBeInTheDocument();
    const text = container.textContent ?? '';
    expect(text).not.toContain('template');
    expect(text).not.toContain('snapshot_fixture');
  });

  it('never prints a safety verdict', () => {
    const { container } = render(<AnswerCard answer={base} />);
    const text = container.textContent?.toLowerCase() ?? '';
    for (const word of ['drinkable', 'pure', 'potable']) expect(text).not.toContain(word);
  });

  it('shows the pending state instead of a zero-violations claim', () => {
    const pending = { ...base, compliancePending: true };
    const { container } = render(<SourcePanel answer={pending} />);
    const text = container.textContent ?? '';
    expect(text).toContain('not yet curated in the snapshot');
    expect(text).toContain('Verify live records at EPA ECHO');
    expect(text).not.toContain('Violations recorded');
  });

  it('lists nearby drinking-water points when present', () => {
    const withPoints = {
      ...base,
      nearbyPoints: [{ name: 'Park fountain', distanceM: 120, osmUrl: 'https://www.openstreetmap.org/node/1' }],
    };
    const { container } = render(<AnswerCard answer={withPoints} />);
    expect(container.textContent).toContain('Park fountain');
    expect(container.textContent).toContain('Unverified community data');
  });

  it('shows the treatment rigor and record tier when present', () => {
    const treated = {
      ...base,
      treatment: { rigor: 'Unfiltered surface water, disinfected', processes: ['GASEOUS CHLORINATION, PRE'] },
      recordTier: 'none-found' as const,
    };
    const { container } = render(<AnswerCard answer={treated} />);
    expect(container.textContent).toContain('Unfiltered surface water, disinfected');
    expect(container.textContent).toContain('Gaseous Chlorination, Pre');
    expect(container.textContent).toContain('No violations found');
  });

  it('hides the treatment section without a profile or curated record', () => {
    const bare = { ...base, treatment: null, recordTier: 'unknown-pending' as const };
    const { container } = render(<AnswerCard answer={bare} />);
    expect(container.textContent).not.toContain('Treatment and compliance record');
  });

  it('toggles the compliance proofs open and closed', () => {
    const { getByRole } = render(<SourcePanel answer={base} />);
    const toggle = getByRole('button', { name: /NY7003493/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders redirects as slim text with no map or metric cards', () => {
    const redirect = {
      ...base,
      scope: 'redirect' as const,
      overview: 'I do not give opinions or commentary outside tap-water records.',
      details: 'Ask it in plain English words.',
      flow: [],
      metrics: [],
    };
    const { container, queryAllByText } = render(<AnswerCard answer={redirect} />);
    expect(container.textContent).toContain('outside tap-water records');
    expect(queryAllByText('Reported quality metrics')).toHaveLength(0);
    expect(queryAllByText(/Regulatory compliance/)).toHaveLength(0);
    expect(queryAllByText(/schematic overlay/i)).toHaveLength(0);
  });

  it('labels other violations separately from monitoring-only', () => {
    const other = { ...base, recordTier: 'other' as const };
    const { container } = render(<AnswerCard answer={other} />);
    expect(container.textContent).toContain('Other violations on record');
    expect(container.textContent).not.toContain('Only monitoring and reporting violations');
  });

  it('does not execute crafted markdown links', () => {
    const evil = {
      ...base,
      overview: '[click](https://example.com" onclick="alert(1) data-x=")',
    };
    const { container } = render(<AnswerCard answer={evil} />);
    // No link element is created for the crafted URL, and no click handler exists.
    expect(container.querySelector('div.markdown a')).toBeNull();
    expect(container.querySelector('[onclick]')).toBeNull();
  });
});
