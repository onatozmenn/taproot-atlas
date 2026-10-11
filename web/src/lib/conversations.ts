import type { ChatMsg } from '../components/chat-pane';

/**
 * Past conversations, kept in this browser only (localStorage). Each one is
 * titled from its first question. Answers are stored whole so a reopened
 * chat shows the same records; when storage is full the oldest chats go first.
 */
export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMsg[];
}

export const CONVERSATIONS_KEY = 'taproot-conversations';
export const MAX_CONVERSATIONS = 30;

export function titleFrom(question: string): string {
  const t = question.replace(/\s+/g, ' ').trim();
  if (!t) return 'New chat';
  return t.length > 48 ? `${t.slice(0, 47).trimEnd()}…` : t;
}

export function newConversationId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function isConversation(x: unknown): x is Conversation {
  if (!x || typeof x !== 'object') return false;
  const c = x as Record<string, unknown>;
  return typeof c.id === 'string' && typeof c.title === 'string' && typeof c.updatedAt === 'number' && Array.isArray(c.messages);
}

export function loadConversations(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): Conversation[] {
  try {
    const raw = storage?.getItem(CONVERSATIONS_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(isConversation)
      .map((c) => ({ ...c, createdAt: typeof c.createdAt === 'number' ? c.createdAt : c.updatedAt, messages: c.messages.map((m) => ({ ...m, fresh: false })) }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_CONVERSATIONS);
  } catch {
    return [];
  }
}

/** Saves newest first; drops the oldest chats until it fits. Returns what was kept. */
export function saveConversations(list: Conversation[], storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): Conversation[] {
  let keep = [...list].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVERSATIONS);
  while (true) {
    try {
      storage?.setItem(CONVERSATIONS_KEY, JSON.stringify(keep.map((c) => ({ ...c, messages: c.messages.map(({ fresh: _f, ...m }) => m) }))));
      return keep;
    } catch {
      // Quota or private mode: drop the oldest and retry; give up at zero.
      if (keep.length <= 1) return keep;
      keep = keep.slice(0, -1);
    }
  }
}

/** Insert or replace one conversation, newest first. */
export function upsertConversation(list: Conversation[], conv: Conversation): Conversation[] {
  return [conv, ...list.filter((c) => c.id !== conv.id)];
}

/** Group label for the sidebar ("Today", "Yesterday", "Previous 7 days", "Older"). */
export function groupLabel(at: number, now = Date.now()): string {
  const day = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const diff = Math.round((day(now) - day(at)) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff <= 7) return 'Previous 7 days';
  if (diff <= 30) return 'Previous 30 days';
  return 'Older';
}
