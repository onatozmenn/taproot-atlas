import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { StudyView, susScore, susGrade, TASKS } from './study-view';
import { ImpactView, oneIn } from '../impact/impact-view';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SUS scoring', () => {
  it('follows the standard formula and grades', () => {
    expect(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100);
    expect(susScore([3, 3, 3, 3, 3, 3, 3, 3, 3, 3])).toBe(50);
    expect(susScore([1, 5, 1, 5, 1, 5, 1, 5, 1, 5])).toBe(0);
    expect(susScore([5, 1, 5])).toBeNull();
    expect(susGrade(68)).toBe('C');
    expect(susGrade(85)).toBe('A+');
    expect(oneIn(0.208)).toBe('1 in 5');
  });
});

describe('Study flow', () => {
  it('runs a participant from role to SUS to results and sends one record', () => {
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    render(<StudyView />);
    fireEvent.click(screen.getByText('I work in water'));
    for (let i = 0; i < TASKS.professional.length; i++) {
      fireEvent.click(screen.getByText(/Start: open Taproot/));
      fireEvent.click(screen.getByText('I did it'));
      const t = TASKS.professional[i];
      if (t.check) fireEvent.click(screen.getByText(t.check.options[t.check.correct]));
      fireEvent.click(screen.getAllByRole('radio', { name: '6' })[0]);
      fireEvent.click(screen.getByText('Next'));
    }
    for (let i = 1; i <= 10; i++) {
      const group = screen.getByRole('radiogroup', { name: `Statement ${i}` });
      fireEvent.click(group.querySelectorAll('button')[i % 2 === 1 ? 4 : 0]);
    }
    fireEvent.click(screen.getByText('Send results'));
    expect(screen.getByText(/You gave Taproot 100 out of 100/)).toBeTruthy();
    expect(beacon).toHaveBeenCalledTimes(1);
  });
});

describe('Resident city', () => {
  it('asks for one city first and names it in every task', () => {
    render(<StudyView />);
    fireEvent.click(screen.getByText('I drink tap water'));
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Denver, CO' } });
    fireEvent.click(screen.getByText('Use it'));
    expect(screen.getByText(/Denver, CO’s tap water/)).toBeTruthy();
  });
});

describe('Impact view', () => {
  it('leads with the latest backtest year and lets you switch years', () => {
    render(<ImpactView />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/January 2025 .* 201 of the 303/);
    fireEvent.click(screen.getByRole('tab', { name: '2023' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/2023/);
    expect(screen.getByText(/What this does not show/)).toBeTruthy();
  });
});
