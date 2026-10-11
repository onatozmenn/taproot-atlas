import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import App from './App';
import { CONVERSATIONS_KEY } from './lib/conversations';

vi.mock('./api', () => ({ askTapWater: vi.fn(() => new Promise(() => undefined)) }));

function renderApp() {
  return render(
    <TooltipProvider>
      <App />
    </TooltipProvider>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('ChatGPT-style shell', () => {
  it('starts on a centred greeting with the composer and suggestion chips', () => {
    renderApp();
    expect(screen.getByRole('heading', { level: 1, name: 'Where does your tap water come from?' })).toBeTruthy();
    expect(screen.getByLabelText('Ask about your tap water')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Is Flint water safe?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send message' })).toHaveProperty('disabled', true);
  });

  it('lists the other pages and past chats in the sidebar, and reopens one', () => {
    const at = Date.now();
    localStorage.setItem(
      CONVERSATIONS_KEY,
      JSON.stringify([
        { id: 'c1', title: 'Is Flint water safe?', createdAt: at, updatedAt: at, messages: [{ id: 1, role: 'user', text: 'Is Flint water safe?', at }] },
      ]),
    );
    renderApp();
    for (const page of ['Triage', 'Impact', 'Global', 'Study', 'Kit']) expect(screen.getByRole('link', { name: page })).toBeTruthy();
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Sidebar' })).getByRole('button', { name: 'Is Flint water safe?' }));
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByText('Is Flint water safe?', { selector: '.cg-bubble span:not(.sr-only)' })).toBeTruthy();
  });

  it('filters chats from the sidebar search', () => {
    const at = Date.now();
    localStorage.setItem(
      CONVERSATIONS_KEY,
      JSON.stringify([
        { id: 'a', title: 'Lead in Chicago', createdAt: at, updatedAt: at, messages: [] },
        { id: 'b', title: 'PFAS in Denver', createdAt: at, updatedAt: at - 1, messages: [] },
      ]),
    );
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Search chats' }));
    fireEvent.change(screen.getByLabelText('Search chats'), { target: { value: 'denver' } });
    expect(screen.queryByRole('button', { name: 'Lead in Chicago' })).toBeNull();
    expect(screen.getByRole('button', { name: 'PFAS in Denver' })).toBeTruthy();
  });
});
