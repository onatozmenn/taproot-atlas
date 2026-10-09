import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { GlobalView, READINESS } from './global-view';

afterEach(cleanup);

describe('Global view', () => {
  it('shows the readiness ladder and the Ireland import', () => {
    render(<GlobalView />);
    for (const r of READINESS) expect(screen.getByText(r.place)).toBeTruthy();
    expect(screen.getByText(/35 supplies serving 467,184 people/)).toBeTruthy();
    expect(screen.getByText('Limerick City Environs')).toBeTruthy();
    expect(screen.queryByText('Whiddy Island')).toBeNull();
    fireEvent.click(screen.getByText('Show all 35'));
    expect(screen.getByText('Whiddy Island')).toBeTruthy();
    expect(screen.getByText('Ask about an Irish supply').getAttribute('href')).toMatch(/^#\/ask\?q=/);
  });
});
