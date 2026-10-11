import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import App from './App';
import { ChatPane, ThinkingState, type ChatMsg } from './components/chat-pane';
import { tokenEnds, tokensAt, balance } from './components/chat/streaming-answer';
import { CONVERSATIONS_KEY, autoTitle, renameConversation, type Conversation } from './lib/conversations';

vi.mock('./api', () => ({ askTapWater: vi.fn(() => new Promise(() => undefined)) }));

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

const wrap = (ui: React.ReactNode) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe('token streaming', () => {
  it('splits text into word tokens and long words into ~4-char pieces', () => {
    const text = 'Lead is low. Unbelievably fine.';
    const ends = tokenEnds(text);
    expect(ends[ends.length - 1]).toBe(text.length);
    expect(text.slice(0, ends[0])).toBe('Lead ');
    expect(ends.some((e) => text.slice(0, e).endsWith('Unbe'))).toBe(true);
  });
  it('paces tokens quickly at first and finishes within 2.4 s', () => {
    expect(tokensAt(0, 100)).toBe(1);
    expect(tokensAt(600, 100)).toBeGreaterThan(30);
    expect(tokensAt(2400, 1000)).toBe(1000);
    expect(tokensAt(100, 0)).toBe(0);
  });
  it('never shows a half-open bold run', () => {
    expect(balance('the **7 pp')).toBe('the **7 pp**');
    expect(balance('the **7** ppb')).toBe('the **7** ppb');
  });
});

describe('chat titles', () => {
  it('names a chat by place and topic once the first answer is in', () => {
    expect(autoTitle('Is Flint water safe?', 'Flint, MI')).toBe('Flint water safety');
    expect(autoTitle('Is there lead in Chicago water?', 'Chicago')).toBe('Chicago lead');
    expect(autoTitle('Does Denver water have PFAS?', 'Denver')).toBe('Denver PFAS');
    expect(autoTitle('Does Los Angeles have nitrate problems?', 'Los Angeles')).toBe('Los Angeles nitrate');
    expect(autoTitle('Compare Detroit and Flint')).toBe('Detroit vs Flint');
    expect(autoTitle('What is a PWSID?')).toBe('What is a PWSID');
  });
  it("renames by hand and marks the title as the user's", () => {
    const list: Conversation[] = [{ id: 'a', title: 'x', createdAt: 1, updatedAt: 1, messages: [] }];
    const out = renameConversation(list, 'a', '  My   tap  ');
    expect(out[0]).toMatchObject({ title: 'My tap', titleSource: 'user' });
    expect(renameConversation(list, 'a', '   ')).toBe(list);
  });
});

describe('thread behaviour', () => {
  const thread: ChatMsg[] = [
    { id: 1, role: 'user', text: 'Is Flint water safe?', at: 1 },
    { id: 2, role: 'assistant', stopped: true },
  ];
  it('edits a question and resends it with Enter; Escape cancels', () => {
    const onEdit = vi.fn();
    wrap(<ChatPane messages={thread} busy={false} onFollowUp={() => undefined} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit message' }));
    fireEvent.keyDown(screen.getByLabelText('Edit your message'), { key: 'Escape' });
    expect(screen.queryByLabelText('Edit your message')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit message' }));
    fireEvent.change(screen.getByLabelText('Edit your message'), { target: { value: 'Is Detroit water safe?' } });
    fireEvent.keyDown(screen.getByLabelText('Edit your message'), { key: 'Enter' });
    expect(onEdit).toHaveBeenCalledWith(1, 'Is Detroit water safe?');
  });
  it('hides edit while an answer is on its way', () => {
    wrap(<ChatPane messages={thread} busy onFollowUp={() => undefined} onEdit={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'Edit message' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy message' })).toBeTruthy();
  });
  it('the thinking state is one polite status with a skeleton', () => {
    wrap(<ThinkingState />);
    const st = screen.getByRole('status', { name: 'Taproot is answering' });
    expect(within(st).getByText(/Answering\. Reading your question\./)).toBeTruthy();
    expect(st.querySelectorAll('.cg-skel i')).toHaveLength(3);
    expect(st.querySelector('.wm.wm-filling')).toBeTruthy();
  });
});

describe('shell', () => {
  const seed = () => {
    const at = Date.now();
    localStorage.setItem(
      CONVERSATIONS_KEY,
      JSON.stringify([{ id: 'c1', title: 'Flint water safety', createdAt: at, updatedAt: at, messages: [{ id: 1, role: 'user', text: 'Is Flint water safe?', at }] }]),
    );
  };
  it('renames a chat from its menu and keeps the name', async () => {
    seed();
    wrap(<App />);
    const side = screen.getByRole('complementary', { name: 'Sidebar' });
    const more = within(side).getByRole('button', { name: 'Options for Flint water safety' });
    fireEvent.pointerDown(more, { button: 0, ctrlKey: false, pointerType: 'mouse' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    const field = within(side).getByLabelText('Chat name');
    fireEvent.change(field, { target: { value: 'Home tap' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(within(side).getByRole('button', { name: 'Home tap' })).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) ?? '[]');
    expect(saved[0]).toMatchObject({ title: 'Home tap', titleSource: 'user' });
  });
  it('Ctrl+Shift+O starts a new chat', () => {
    seed();
    wrap(<App />);
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Sidebar' })).getByRole('button', { name: 'Flint water safety' }));
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    fireEvent.keyDown(window, { key: 'O', ctrlKey: true, shiftKey: true });
    expect(screen.getByRole('heading', { level: 1, name: 'Where does your tap water come from?' })).toBeTruthy();
  });
  it('Ctrl+/ opens the keyboard shortcuts', async () => {
    wrap(<App />);
    fireEvent.keyDown(window, { key: '/', ctrlKey: true });
    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeTruthy();
  });
  it('record pages render inside the same shell, with the sidebar and the page name in the top bar', () => {
    wrap(<App page={{ label: 'Triage', node: <p>Queue goes here</p> }} />);
    expect(screen.getByRole('main', { name: 'Triage' })).toHaveTextContent('Queue goes here');
    expect(screen.getByRole('link', { name: 'Triage' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeTruthy();
  });
  it('the start screen carries the droplet mark and the water surface', () => {
    const { container } = wrap(<App />);
    expect(container.querySelector('.cg-hello-mark .wm')).toBeTruthy();
    expect(container.querySelectorAll('.cg-surface .cg-swell')).toHaveLength(3);
  });
});
