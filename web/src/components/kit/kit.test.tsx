import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClarifyCard, FollowUpList, SourceStack, ThinkingTrace, formatElapsed } from '.';

describe('Taproot Kit', () => {
  it('formats elapsed time', () => {
    expect(formatElapsed(3240)).toBe('3.2s');
    expect(formatElapsed(63000)).toBe('1m 03s');
  });

  it('settles the trace to one line and opens on tap', () => {
    render(<ThinkingTrace steps={[{ label: 'Found City of Phoenix', detail: 'AZ0407025' }, { label: 'Wrote the answer' }]} working={false} elapsedMs={3200} />);
    const head = screen.getByRole('button', { name: /Checked 2 records/ });
    expect(head.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('AZ0407025')).toBeTruthy();
  });

  it('folds sources open in place', () => {
    render(<SourceStack sources={[{ href: 'https://echo.epa.gov/x', title: 'EPA ECHO', publisher: 'U.S. EPA' }]} />);
    const t = screen.getByRole('button', { name: /1 source/ });
    fireEvent.click(t);
    expect(t.getAttribute('aria-expanded')).toBe('true');
  });

  it('picks a follow-up', () => {
    const onPick = vi.fn();
    render(<FollowUpList items={['Is there lead?']} onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Is there lead?' }));
    expect(onPick).toHaveBeenCalledWith('Is there lead?');
  });

  it('clarify card needs a choice before Continue', () => {
    const onChoose = vi.fn();
    render(<ClarifyCard question="Which Springfield?" options={[{ label: 'Springfield, IL' }, { label: 'Springfield, MO' }]} onChoose={onChoose} />);
    const go = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: /Springfield, MO/ }));
    fireEvent.click(go);
    expect(onChoose).toHaveBeenCalledWith({ label: 'Springfield, MO' });
  });
});
