import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandPalette } from './command-palette';

// jsdom has no layout: cmdk scrolls the active item into view.
Element.prototype.scrollIntoView = () => {};
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;

describe('CommandPalette', () => {
  it('opens without crashing and asks a typed question', () => {
    const onPick = vi.fn();
    render(<CommandPalette open onOpenChange={() => {}} onPick={onPick} />);
    const input = screen.getByPlaceholderText(/Ask about tap water/);
    fireEvent.change(input, { target: { value: 'lead in Tulsa' } });
    fireEvent.click(screen.getByText(/Ask “lead in Tulsa”/));
    expect(onPick).toHaveBeenCalledWith('lead in Tulsa');
  });

  it('dims question picks while busy instead of dropping them silently', () => {
    const onPick = vi.fn();
    const onOpenChange = vi.fn();
    render(<CommandPalette open onOpenChange={onOpenChange} onPick={onPick} busy />);
    const option = screen.getByRole('option', { name: /Where does Chicago tap water come from/ });
    expect(option.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(option);
    expect(onPick).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
