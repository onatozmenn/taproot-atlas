import { describe, it, expect } from 'vitest';
import { suggestFollowUps } from './suggest';

describe('suggestFollowUps', () => {
  it('offers violation + metric + map chips for the showcase', () => {
    const chips = suggestFollowUps({
      violations: 0,
      windowStart: '2021-01-01',
      windowEnd: '2026-01-01',
      boundaryType: 'verified_agency',
      metrics: [{ parameter: 'Turbidity', reportPeriod: '2025 Annual' }],
    });
    expect(chips).toHaveLength(3);
    expect(chips[0]).toContain('2021-01-01');
    expect(chips[1]).toContain('Turbidity');
    expect(chips[2]).toBe('Show the watershed map');
  });

  it('names the window when violations exist', () => {
    const chips = suggestFollowUps({
      violations: 2,
      windowStart: '2021-01-01',
      windowEnd: '2026-01-01',
      boundaryType: 'verified_agency',
      metrics: [],
    });
    expect(chips[0]).toContain('violation');
  });

  it('falls back to OSM wording outside coverage', () => {
    const chips = suggestFollowUps({
      violations: 0,
      windowStart: '2021-01-01',
      windowEnd: '2026-01-01',
      boundaryType: 'unverified_fallback',
      metrics: [],
    });
    expect(chips).toEqual([
      'Where is the nearest public drinking point?',
      'Why is this boundary unverified?',
    ]);
  });
});
