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
  /** 'user' once renamed by hand: auto-titling never overwrites it. */
  titleSource?: 'auto' | 'user';
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

const TOPICS: Array<[RegExp, string]> = [
  [/\b(compare|versus|vs\.?)\b/i, 'comparison'],
  [/\blead\b|kur\u015fun/i, 'lead'],
  [/\b(pfas|pfoa|pfos|forever chemicals?)\b/i, 'PFAS'],
  [/\b(nitrates?|arsenic|fluoride|chlorine|copper|uranium|radium|hardness|coliform|bacteria)\b/i, ''],
  [/\b(violations?|complian\w*|fines?)\b/i, 'violations'],
  [/\b(risk|forecast|score)\b/i, 'risk forecast'],
  [/\b(inspect\w*|survey)\b/i, 'inspection'],
  [/\b(come from|source|where does|watershed|reservoir)\b|nereden/i, 'water source'],
  [/\b(reach|route|pipes?|pathway|get to)\b/i, 'route to tap'],
  [/\b(safe|drink|healthy|clean)\b|g\u00fcvenli|i\u00e7ilir/i, 'water safety'],
];

/**
 * A short ChatGPT-style title from the first question and its answer:
 * "Flint water safety", "Chicago lead", "Detroit vs Flint". Falls back to
 * the trimmed question when the answer names no place.
 */
export function autoTitle(question: string, place?: string | null): string {
  const q = question.replace(/\s+/g, ' ').trim();
  const cmp = q.match(/compare\s+(.+?)\s+(?:and|with|to|vs\.?)\s+(.+?)(?:\s+water)?[?.!]*$/i);
  if (cmp) return titleFrom(`${cmp[1]} vs ${cmp[2]}`);
  let topic = '';
  for (const [re, label] of TOPICS) {
    const m = q.match(re);
    if (m) {
      topic = label || (m[1] ?? m[0]).toLowerCase();
      break;
    }
  }
  const city = (place ?? '').replace(/,\s*[A-Z]{2}$/, '').trim();
  if (city && topic) return titleFrom(`${city} ${topic}`);
  if (city) return titleFrom(`${city} water`);
  return titleFrom(q.replace(/[?.!]+$/, ''));
}

/** Rename one conversation by hand (empty names are ignored). */
export function renameConversation(list: Conversation[], id: string, title: string): Conversation[] {
  const t = title.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!t) return list;
  return list.map((c) => (c.id === id ? { ...c, title: t, titleSource: 'user' as const } : c));
}
