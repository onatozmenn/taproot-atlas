import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { triage } from '../../../../lib/triage';
import { TriageView, caught, parseTriageHash } from './triage-view';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const q = new URLSearchParams(String(url).split('?')[1]);
    const out = triage({
      state: q.get('state') ?? undefined,
      hidden: q.get('hidden') === '1',
      vulnerable: q.get('vulnerable') === '1',
      limit: Number(q.get('limit') ?? 25),
    });
    return new Response(JSON.stringify(out), { status: 200 });
  });
}

describe('Triage view', () => {
  it('reads the state from the hash and interpolates the capacity curve', () => {
    expect(parseTriageHash('#/triage?state=oh').state).toBe('OH');
    expect(parseTriageHash('#/triage?state=zz').state).toBeNull();
    expect(caught([0.2, 0.5], [0.1, 0.2], 0.15)).toBeCloseTo(0.35);
    expect(caught([0.2, 0.5], [0.1, 0.2], 0.05)).toBeCloseTo(0.1);
  });

  it('loads a state queue, shows the capacity planner, fairness check and expandable rows', async () => {
    const f = mockApi();
    render(<TriageView initialState="OH" />);
    await waitFor(() => expect(screen.getByText('Priority queue')).toBeTruthy());
    expect(String(f.mock.calls[0][0])).toContain('state=OH');
    expect(screen.getByText(/Taking them in Taproot’s order/)).toBeTruthy();
    expect(screen.getByText(/Fairness check/)).toBeTruthy();
    const first = screen.getAllByRole('button', { expanded: false })[0];
    fireEvent.click(first);
    expect(screen.getByText(/Suggested first step/)).toBeTruthy();
  });

  it('filters to systems EPA formula would not flag', async () => {
    const f = mockApi();
    render(<TriageView />);
    await waitFor(() => expect(screen.getByText('Priority queue')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Not flagged by EPA formula' }));
    await waitFor(() => expect(f.mock.calls.some((c) => String(c[0]).includes('hidden=1'))).toBe(true));
  });
});
