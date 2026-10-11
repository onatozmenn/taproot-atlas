import { describe, expect, it } from 'vitest';
import { CONVERSATIONS_KEY, groupLabel, loadConversations, saveConversations, threadTouch, titleFrom, upsertConversation, type Conversation } from './conversations';

function memStore(limit = Infinity) {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (v.length > limit) throw new Error('QuotaExceededError');
      data.set(k, v);
    },
  };
}

const conv = (id: string, updatedAt: number, text = 'Is Flint water safe?'): Conversation => ({
  id,
  title: titleFrom(text),
  createdAt: updatedAt,
  updatedAt,
  messages: [{ id: 1, role: 'user', text, at: updatedAt, fresh: true }],
});

describe('conversations store', () => {
  it('titles a chat from its first question, trimmed', () => {
    expect(titleFrom('  Is   Flint water safe? ')).toBe('Is Flint water safe?');
    expect(titleFrom('x'.repeat(80))).toHaveLength(48);
    expect(titleFrom('')).toBe('New chat');
  });

  it('round-trips newest first and never restores the streaming flag', () => {
    const s = memStore();
    saveConversations([conv('a', 1), conv('b', 2)], s);
    const back = loadConversations(s);
    expect(back.map((c) => c.id)).toEqual(['b', 'a']);
    expect(back[0].messages[0].fresh).toBe(false);
  });

  it('drops the oldest chats when storage is full', () => {
    const one = JSON.stringify([conv('a', 1)]).length;
    const s = memStore(one * 2 + 10);
    const kept = saveConversations([conv('a', 1), conv('b', 2), conv('c', 3)], s);
    expect(kept.map((c) => c.id)).toEqual(['c', 'b']);
    expect(JSON.parse(s.data.get(CONVERSATIONS_KEY) ?? '[]')).toHaveLength(2);
  });

  it('ignores corrupt storage', () => {
    const s = memStore();
    s.data.set(CONVERSATIONS_KEY, '{nope');
    expect(loadConversations(s)).toEqual([]);
    s.data.set(CONVERSATIONS_KEY, JSON.stringify([{ id: 1 }, conv('ok', 5)]));
    expect(loadConversations(s).map((c) => c.id)).toEqual(['ok']);
  });

  it('upserts in place and groups by day', () => {
    const list = upsertConversation([conv('a', 1), conv('b', 2)], { ...conv('a', 9), title: 'changed' });
    expect(list.map((c) => c.id)).toEqual(['a', 'b']);
    expect(list[0].title).toBe('changed');
    const now = new Date(2026, 9, 11, 12).getTime();
    expect(groupLabel(now - 3600_000, now)).toBe('Today');
    expect(groupLabel(now - 86400_000, now)).toBe('Yesterday');
    expect(groupLabel(now - 5 * 86400_000, now)).toBe('Previous 7 days');
    expect(groupLabel(now - 90 * 86400_000, now)).toBe('Older');
  });

  it('only the thread written in moves to the top', () => {
    const old = conv('a', 1000);
    // Reopening (same message count) keeps the old timestamp.
    expect(threadTouch(old, 1, 2000)).toBe(1000);
    // A new message moves it to now.
    expect(threadTouch(old, 2, 2000)).toBe(2000);
    // A brand-new thread starts at now.
    expect(threadTouch(undefined, 1, 2000)).toBe(2000);
  });
});
