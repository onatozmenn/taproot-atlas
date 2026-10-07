import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { loadProfile } from '../../../../lib/profile';
import type { TapAnswer } from '../../api';
import { WaterReport, defaultReportTab } from './water-report';

vi.mock('../RealMap', () => ({ RealMap: () => null }));
afterEach(() => cleanup());

function answerFor(pwsid: string, question: string, focus: TapAnswer['focus'] = 'quality'): TapAnswer {
  const profile = loadProfile(pwsid);
  if (!profile) throw new Error(`no profile for ${pwsid}`);
  return {
    systemName: profile.name, placeName: 'Test City', alternatives: [], profile, question,
    pwsid, boundaryType: 'UNVERIFIED_FALLBACK', scope: 'water', compliancePending: false, nearbyPoints: [],
    treatment: null, facilities: [], sellerChain: [], facilityProvenanceUrl: null, lcr: [], ucmr: [], syr: [],
    distribution: [], upstream: null, waterUse: null, conveyances: [], place: null, coverage: [],
    recordTier: 'none-found', basins: [], overview: '', details: '', flow: [], metrics: [], windowStart: '2021-01-01',
    windowEnd: '2026-01-01', violations: 0, echoUrl: 'https://echo.epa.gov/', verifiedAt: '', disclaimer: '',
    markdown: '', followUps: [], focus, answerAuthor: 'template', passedAudit: true, auditTimestamp: '',
    recordSource: 'snapshot_fixture', narrator: 'template', jev: 'skipped',
  };
}

describe('WaterReport', () => {
  it('opens on the topic asked and shows PFAS above-limit bars', () => {
    const a = answerFor('CA3410020', 'PFAS in Sacramento?');
    expect(defaultReportTab(a)).toBe('pfas');
    render(<WaterReport answer={a} initiallyOpen />);
    expect(screen.getByText(/Test City water report/)).toBeTruthy();
    expect(screen.getByText(/above limit/)).toBeTruthy();
    expect(screen.getByText(/Highest result per compound/)).toBeTruthy();
  });

  it('lead tab draws the 90th-percentile chart with the action level', () => {
    const a = answerFor('IL0316000', 'Is there lead in Chicago water?');
    render(<WaterReport answer={a} initiallyOpen />);
    expect(screen.getByRole('img', { name: /Lead, 90th percentile/ })).toBeTruthy();
    expect(screen.getAllByText(/Action level 15 ppb/).length).toBeGreaterThan(0);
  });

  it('lab table filters by search and every tab renders', () => {
    const a = answerFor('AZ0407025', 'arsenic in Phoenix');
    render(<WaterReport answer={a} initiallyOpen />);
    const input = screen.getByPlaceholderText(/Search \d+ contaminants/);
    fireEvent.change(input, { target: { value: 'arsenic' } });
    expect(screen.getAllByText('Arsenic').length).toBeGreaterThan(0);
    for (const name of ['Overview', 'Violations', 'Source & route', 'Lead', 'PFAS']) {
      const tab = screen.queryByRole('tab', { name });
      if (tab) fireEvent.click(tab);
    }
    expect(screen.getByText(/EPA ECHO profile/)).toBeTruthy();
  });
});
