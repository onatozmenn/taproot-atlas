import { describe, it, expect, afterEach, vi } from 'vitest';
import { act } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { loadMaplibre } from '../RealMap';
import { loadProfile } from '../../../../lib/profile';
import type { TapAnswer } from '../../api';
import { VisualAnswer, visualKind } from './visual-answer';

vi.mock('../RealMap', () => ({ loadMaplibre: vi.fn(() => new Promise(() => {})) }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

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

describe('VisualAnswer picks one figure per question', () => {
  it('routes each kind of question to its own drawing', () => {
    expect(visualKind(answerFor('IL0316000', 'Is there lead in Chicago water?')).kind).toBe('lead');
    expect(visualKind(answerFor('AZ0407100', 'PFAS in Tempe?')).kind).toBe('pfas');
    expect(visualKind(answerFor('CA3410020', 'nitrate in Sacramento')).kind).toBe('lab');
    expect(visualKind(answerFor('MS0250008', 'bacteria in Jackson')).kind).toBe('bacteria');
    expect(visualKind(answerFor('TX1010013', 'Any violations in Houston?', 'compliance')).kind).toBe('violations');
    expect(visualKind(answerFor('TX2270001', 'How does Austin water reach my tap?', 'pathway')).kind).toBe('journey');
    expect(visualKind(answerFor('CO0116001', 'Where does Denver water come from?', 'source')).kind).toBe('map');
    expect(visualKind(answerFor('AZ0407025', 'Is Phoenix water safe?', 'general')).kind).toBe('signals');
  });

  it('lead: drops against the action-level waterline', () => {
    render(<VisualAnswer answer={answerFor('IL0316000', 'Is there lead in Chicago water?')} />);
    expect(screen.getByText(/Action level · 15 ppb/)).toBeTruthy();
    expect(screen.getByRole('img', { name: /Lead results by testing round/ })).toBeTruthy();
  });

  it('PFAS: rings flag compounds over the limit', () => {
    render(<VisualAnswer answer={answerFor('AZ0407100', 'PFAS in Tempe?')} />);
    expect(screen.getByText(/above the limit/)).toBeTruthy();
    expect(screen.getAllByText(/× limit/).length).toBeGreaterThan(0);
  });

  it('lab: a tube with the federal limit', () => {
    render(<VisualAnswer answer={answerFor('CA3410020', 'nitrate in Sacramento')} />);
    expect(screen.getByText(/of the limit/)).toBeTruthy();
    expect(screen.getAllByText(/limit 10 mg\/L/).length).toBeGreaterThan(0);
  });

  it('violations: tapping a stone reads it in plain words', async () => {
    render(<VisualAnswer answer={answerFor('TX1010013', 'Any violations in Houston?', 'compliance')} />);
    const stones = screen.getAllByRole('button').filter((b) => b.tagName.toLowerCase() === 'g');
    expect(stones.length).toBeGreaterThan(0);
    fireEvent.click(stones[stones.length - 1]);
    expect(await screen.findByText(/· (fixed|still open|resolved)/, {}, { timeout: 3000 })).toBeTruthy();
  });

  it('violations: a ten-year Tracker strip under the river, one block a year', () => {
    render(<VisualAnswer answer={answerFor('TX1010013', 'Any violations in Houston?', 'compliance')} />);
    const years = screen.getAllByRole('button').filter((b) => /^\d{4}: /.test(b.getAttribute('aria-label') ?? ''));
    expect(years).toHaveLength(10);
  });

  it('safety: four dials, and a dial asks a follow-up', () => {
    const onAsk = vi.fn();
    render(<VisualAnswer answer={answerFor('AZ0407025', 'Is Phoenix water safe?', 'general')} onAsk={onAsk} />);
    expect(screen.getByText(/four checks against federal limits/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Lead:/ }));
    expect(onAsk).toHaveBeenCalledWith('Is there lead in Test City water?');
  });

  it('pathway: a pipe of stops ending at your tap', () => {
    render(<VisualAnswer answer={answerFor('TX2270001', 'How does Austin water reach my tap?', 'pathway')} />);
    expect(screen.getByText('Your tap')).toBeTruthy();
    expect(screen.getByText(/stops to your glass/)).toBeTruthy();
  });

  it('map: a failed load falls back to the SVG map', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
    vi.mocked(loadMaplibre).mockRejectedValueOnce(new Error('no webgl'));
    render(<VisualAnswer answer={answerFor('CO0116001', 'Where does Denver water come from?', 'source')} />);
    expect(await screen.findByRole('img', { name: /Map of the area/ }, { timeout: 3000 })).toBeTruthy();
  });

  it('map: a stalled basemap times out into the fallback', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
    vi.useFakeTimers();
    class FakeMap {
      on() {
        return this;
      }
      remove() {}
      isStyleLoaded() {
        return false;
      }
    }
    vi.mocked(loadMaplibre).mockResolvedValueOnce({ Map: FakeMap } as never);
    render(<VisualAnswer answer={answerFor('CO0116001', 'Where does Denver water come from?', 'source')} />);
    expect(screen.queryByRole('img', { name: /Map of the area/ })).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16000);
    });
    expect(screen.getByRole('img', { name: /Map of the area/ })).toBeTruthy();
  });
});

describe('RiskForecast', () => {
  it('routes forecast questions to the forecast figure and draws drivers', () => {
    const a = answerFor('IL0316000', "What's the risk of a violation in Chicago next year?");
    expect(visualKind(a).kind).toBe('risk');
    render(<VisualAnswer answer={a} />);
    expect(screen.getByText(/chance of a new health-based violation in 2026/)).toBeTruthy();
    expect(screen.getByText(/What moved it/)).toBeTruthy();
    expect(screen.getByText(/EPA targeting score/)).toBeTruthy();
  });
});
