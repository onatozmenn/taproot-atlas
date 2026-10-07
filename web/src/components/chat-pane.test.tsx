import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ChatPane, type ChatMsg } from './chat-pane';
import { sourcesFor } from './chat/answer-actions';
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
  facilities: [],
  sellerChain: [],
  facilityProvenanceUrl: null,
  lcr: [],
  ucmr: [],
  syr: [],
  distribution: [],
  upstream: null,
  waterUse: null,
  conveyances: [],
  place: null,
  coverage: [],
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
  markdown: '**NYC** gets its water from the Catskill and Delaware basins.\n\n- **Turbidity**: 0.08 NTU',
  followUps: ['Is there lead in New York City water?', 'Any violations for New York City in the last 5 years?'],
  focus: 'source',
  answerAuthor: 'template',
  jev: 'skipped',
};

function renderPane(messages: ChatMsg[], onFollowUp = (_q: string) => {}) {
  return render(
    <TooltipProvider>
      <ChatPane messages={messages} busy={false} onFollowUp={onFollowUp} />
    </TooltipProvider>,
  );
}

describe('ChatPane (America.gov-style chat)', () => {
  it('renders the question bubble and the markdown answer', () => {
    renderPane([
      { id: 1, role: 'user', text: 'Where does NYC water come from?' },
      { id: 2, role: 'assistant', answer: base },
    ]);
    expect(screen.getByText('Where does NYC water come from?')).toBeTruthy();
    expect(screen.getByText('NYC').tagName).toBe('STRONG');
    expect(screen.getByText(/Catskill and Delaware basins/)).toBeTruthy();
  });

  it('shows follow-up pills on the latest answer and sends the pill text', () => {
    const sent: string[] = [];
    renderPane([{ id: 2, role: 'assistant', answer: base }], (q) => sent.push(q));
    fireEvent.click(screen.getByRole('button', { name: 'Is there lead in New York City water?' }));
    expect(sent).toEqual(['Is there lead in New York City water?']);
  });

  it('shows a Sources pill and the feedback/copy actions', () => {
    renderPane([{ id: 2, role: 'assistant', answer: base }]);
    expect(screen.getByRole('button', { name: /Sources/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Good response' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
  });

  it('redirect answers get no sources and no records card', () => {
    renderPane([{ id: 2, role: 'assistant', answer: { ...base, scope: 'redirect', followUps: [] } }]);
    expect(screen.queryByRole('button', { name: /Sources/ })).toBeNull();
    expect(screen.queryByText(/PWSID NY7003493/)).toBeNull();
  });

  it('collects ECHO and report sources without duplicates', () => {
    const s = sourcesFor(base);
    expect(s.map((x) => x.href)).toEqual([base.echoUrl, base.metrics[0].provenance.sourceDocumentUrl]);
  });
});
