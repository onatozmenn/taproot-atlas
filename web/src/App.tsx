import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { ChevronDown, Command as CommandIcon, Info, Keyboard, Moon, PanelLeft, Shield, SquarePen, Sun } from 'lucide-react';
import { askTapWater } from './api';
import { ChatPane, type ChatMsg } from './components/chat-pane';
import { InfoDialogs, type InfoDialogKind } from './components/chat/info-dialogs';
import { CommandPalette, useCommandPalette } from './components/command-palette';
import { Composer } from './components/composer';
import { APP_PAGES, AppSidebar } from './components/shell/app-sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from './components/ui/tooltip';
import {
  autoTitle,
  loadConversations,
  newConversationId,
  renameConversation,
  saveConversations,
  titleFrom,
  upsertConversation,
  type Conversation,
} from './lib/conversations';
import { WaterMark, WaterSurface } from './components/shell/water-mark';
import './styles/water.css';
import { cn } from './lib/utils';
import './styles/record-chat.css';
import './styles/chatgpt-shell.css';

let nextId = 1;

const SUGGESTIONS = [
  { q: 'Is Flint water safe?', hint: 'Lead, violations and the record' },
  { q: 'Is there lead in Chicago water?', hint: 'Lead & Copper results' },
  { q: 'Does Denver water have PFAS?', hint: 'UCMR 5 tests' },
  { q: 'Where does Jackson MS water come from?', hint: 'Source to tap' },
];

const SIDEBAR_KEY = 'taproot-sidebar';

function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false);
  const [match, setMatch] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [query]);
  return match;
}

function IconButton({ label, onClick, children, className }: { label: string; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={onClick} aria-label={label} className={cn('cg-icon-btn', className)}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** The system the conversation is about: the latest answered one, if any. */
function contextOf(list: ChatMsg[]): string | undefined {
  return [...list].reverse().find((m) => m.role === 'assistant' && m.answer && m.answer.scope === 'water' && m.answer.pwsid !== 'UNKNOWN')?.answer?.pwsid ?? undefined;
}

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  return Boolean(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable));
}

export interface ShellPage {
  /** Page name in the top bar ("Triage"). */
  label: string;
  node: ReactNode;
}

export default function App({ page = null }: { page?: ShellPage | null } = {}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [listening, setListening] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [info, setInfo] = useState<InfoDialogKind>(null);
  const [paletteOpen, setPaletteOpen] = useCommandPalette();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mobile = useMediaQuery('(max-width: 767px)');
  const [sideOpen, setSideOpen] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) !== 'closed';
    } catch {
      return true;
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Synchronous lock: two Enters in the same frame both see busy=false.
  const busyRef = useRef(false);
  // Bumped on New chat / switching chats so a late answer never lands in the wrong thread.
  const genRef = useRef(0);
  const lastQuestion = useRef('');
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeId;

  const empty = messages.length === 0;
  const contextPwsid = contextOf(messages);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, sideOpen ? 'open' : 'closed');
    } catch {
      // Private mode: the rail state is per-visit only.
    }
  }, [sideOpen]);

  // Every change to the open thread is saved under its conversation.
  useEffect(() => {
    if (!activeId || messages.length === 0) return;
    setConversations((list) => {
      const prev = list.find((c) => c.id === activeId);
      const firstQ = messages.find((m) => m.role === 'user')?.text ?? '';
      const firstA = messages.find((m) => m.role === 'assistant' && m.answer)?.answer;
      // ChatGPT-style naming: a short topic title once the first answer is in,
      // unless the user renamed the chat by hand.
      const userTitled = prev?.titleSource === 'user';
      const place = firstA && firstA.scope === 'water' && firstA.pwsid !== 'UNKNOWN' ? firstA.placeName : null;
      const conv: Conversation = {
        id: activeId,
        titleSource: userTitled ? 'user' : 'auto',
        title: userTitled && prev ? prev.title : firstA ? autoTitle(firstQ, place) : titleFrom(firstQ),
        createdAt: prev?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        messages,
      };
      return saveConversations(upsertConversation(list, conv));
    });
  }, [messages, activeId]);

  async function run(q: string, pinPwsid?: string, ctx: string | undefined | null = null) {
    const context = ctx === null ? contextPwsid : ctx;
    const gen = genRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    busyRef.current = true;
    setBusy(true);
    lastQuestion.current = q;
    if (!activeRef.current) {
      const id = newConversationId();
      activeRef.current = id;
      setActiveId(id);
    }
    setMessages((m) => [...m.map((x) => ({ ...x, fresh: false })), { id: nextId++, role: 'user', text: q, at: Date.now() }]);
    setInput('');
    const started = performance.now();
    try {
      const answer = await askTapWater(q, {
        signal: controller.signal,
        ...(coords ? { lat: coords.lat, lon: coords.lon } : {}),
        ...(context ? { contextPwsid: context } : {}),
        ...(pinPwsid ? { pwsid: pinPwsid } : {}),
      });
      if (gen !== genRef.current) return;
      setMessages((m) => [...m, { id: nextId++, role: 'assistant', answer: { ...answer, question: q }, fresh: true, elapsedMs: performance.now() - started }]);
    } catch (e) {
      if (gen !== genRef.current) return;
      if (controller.signal.aborted) {
        setMessages((m) => [...m, { id: nextId++, role: 'assistant', stopped: true }]);
      } else {
        const msg = e instanceof Error ? e.message : 'Lookup failed. Check your connection and retry.';
        toast.error(msg, { action: { label: 'Retry', onClick: () => void send(lastQuestion.current) } });
      }
    } finally {
      if (gen === genRef.current) {
        abortRef.current = null;
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  function send(question: string, pinPwsid?: string) {
    const q = question.trim().slice(0, 2000);
    if (!q || busy || busyRef.current) return;
    busyRef.current = true;
    if (empty) {
      // The centred start view dissolves, then the thread fades in with the
      // question placed and the composer docked at the bottom.
      setLeaving(true);
      const gen = genRef.current;
      window.setTimeout(() => {
        setLeaving(false);
        if (gen !== genRef.current) {
          busyRef.current = false;
          return;
        }
        void run(q, pinPwsid);
      }, 220);
      return;
    }
    void run(q, pinPwsid);
  }

  // `#/ask?q=…` (from the triage queue or an in-answer link) asks once, then clears.
  useEffect(() => {
    const take = () => {
      const h = window.location.hash;
      if (!h.startsWith('#/ask')) return;
      const params = new URLSearchParams(h.split('?')[1] ?? '');
      const q = params.get('q');
      const pin = params.get('pwsid') ?? undefined;
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      if (q) sendRef.current(q, pin && /^[A-Z]{2}\d{7}$/.test(pin) ? pin : undefined);
    };
    take();
    window.addEventListener('hashchange', take);
    return () => window.removeEventListener('hashchange', take);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendRef = useRef(send);
  sendRef.current = send;

  function stop() {
    abortRef.current?.abort();
  }

  /** Leave the current thread: cancel any answer in flight without writing it anywhere. */
  function detach() {
    genRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    setBusy(false);
    setLeaving(false);
  }

  function newChat() {
    detach();
    setMessages([]);
    setActiveId(null);
    activeRef.current = null;
    setInput('');
  }

  function openChat(id: string) {
    if (id === activeId) return;
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    detach();
    setMessages(conv.messages.map((m) => ({ ...m, fresh: false })));
    nextId = Math.max(nextId, ...conv.messages.map((m) => m.id + 1));
    setActiveId(id);
    activeRef.current = id;
    setInput('');
  }

  function deleteChat(id: string) {
    const gone = conversations.find((c) => c.id === id);
    setConversations((list) => saveConversations(list.filter((c) => c.id !== id)));
    if (id === activeId) newChat();
    if (gone) {
      toast('Chat deleted', {
        description: gone.title,
        action: { label: 'Undo', onClick: () => setConversations((list) => saveConversations(upsertConversation(list, gone))) },
      });
    }
  }

  function clearAll() {
    setConversations(saveConversations([]));
    newChat();
    toast.success('All chats deleted from this browser.');
  }

  function regenerate(q: string) {
    if (busy || busyRef.current) return;
    // Drop the last question and its answer, then ask it again with the
    // context it was first asked in.
    const lastUser = messages.map((x) => x.role).lastIndexOf('user');
    const before = lastUser >= 0 ? messages.slice(0, lastUser) : messages;
    setMessages(before);
    void run(q, undefined, contextOf(before));
  }

  /** ChatGPT's edit-and-resend: the edited question replaces it and everything after. */
  function editAndResend(id: number, text: string) {
    if (busy || busyRef.current) return;
    const i = messages.findIndex((m) => m.id === id);
    if (i < 0) return;
    const before = messages.slice(0, i);
    setMessages(before);
    void run(text, undefined, contextOf(before));
  }

  function renameChat(id: string, title: string) {
    setConversations((list) => saveConversations(renameConversation(list, id, title)));
  }

  function toggleLocate() {
    if (coords) {
      setCoords(null);
      return;
    }
    if (!('geolocation' in navigator)) {
      toast.error('Location is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        toast.success('Location on. It goes with your next question only.');
      },
      () => {
        setLocating(false);
        toast.error('Could not read your location. Check the browser permission and retry.');
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  }

  function toggleVoice() {
    const SR: unknown =
      (window as unknown as Record<string, unknown>).SpeechRecognition ??
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (typeof SR !== 'function') {
      toast.error('Voice input is not available in this browser.');
      return;
    }
    try {
      const Rec = SR as new () => {
        lang: string;
        interimResults: boolean;
        onresult: ((e: { results?: Array<Array<{ transcript?: string }>> }) => void) | null;
        onend: (() => void) | null;
        onerror: (() => void) | null;
        start: () => void;
      };
      const rec = new Rec();
      rec.lang = 'en-US';
      rec.interimResults = false;
      setListening(true);
      rec.onresult = (e) => {
        const text = e.results?.[0]?.[0]?.transcript ?? '';
        if (text) send(text);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      rec.start();
    } catch {
      setListening(false);
    }
  }

  async function attachFile(file: File) {
    if (file.size > 200 * 1024) {
      toast.error('File is too large. Attach a text file under 200 KB.');
      return;
    }
    try {
      const text = (await file.text()).slice(0, 2000);
      setInput((cur) => `${cur}${cur && !cur.endsWith(' ') ? ' ' : ''}${text}`.slice(0, 2000));
    } catch {
      toast.error('Could not read that file. Try a .txt, .md, .csv or .json file.');
    }
  }

  const closeSide = useCallback(() => {
    if (mobile) setDrawerOpen(false);
    else setSideOpen(false);
    // The sidebar goes inert: hand focus to the button that brings it back.
    window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.cg-top [aria-label="Open sidebar"]')?.focus({ preventScroll: true }));
  }, [mobile]);
  const openSide = () => (mobile ? setDrawerOpen(true) : setSideOpen(true));
  const railOpen = mobile ? drawerOpen : sideOpen;

  // Leaving mobile width closes the drawer so it never reappears on rotate.
  useEffect(() => {
    if (!mobile) setDrawerOpen(false);
  }, [mobile]);

  // ChatGPT's keyboard shortcuts (Ctrl on Windows/Linux, Cmd on macOS).
  const keysRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keysRef.current = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (mod && e.shiftKey && k === 'o') {
      e.preventDefault();
      if (page) window.location.hash = '#/';
      newChat();
      window.requestAnimationFrame(() => document.getElementById('composer-input')?.focus());
    } else if (mod && e.shiftKey && k === 's') {
      e.preventDefault();
      if (railOpen) closeSide();
      else openSide();
    } else if (e.shiftKey && e.key === 'Escape') {
      e.preventDefault();
      document.getElementById('composer-input')?.focus();
    } else if (mod && e.shiftKey && k === 'c' && !isTyping(e.target)) {
      const last = [...messages].reverse().find((m) => m.role === 'assistant' && m.answer)?.answer;
      if (!last) return;
      e.preventDefault();
      void navigator.clipboard?.writeText(last.markdown).then(
        () => toast.success('Answer copied'),
        () => toast.error('Could not copy the answer.'),
      );
    } else if (mod && (e.key === '/' || e.key === '?')) {
      e.preventDefault();
      setInfo('keys');
    }
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => keysRef.current(e);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  const composerProps = {
    input,
    onInputChange: setInput,
    onSend: send,
    busy,
    onStop: stop,
    onAttachFile: attachFile,
    onVoice: toggleVoice,
    listening,
    onLocate: toggleLocate,
    locating,
    coordsActive: coords !== null,
  };

  const foot = (
    <>
      Taproot reads public EPA records and can make mistakes. It is not a test of your tap.{' '}
      <button type="button" onClick={() => setInfo('how')}>
        How it works
      </button>
    </>
  );

  const dark = resolvedTheme === 'dark';

  return (
    <div className={cn('cg-app', railOpen && !mobile && 'rail-open', page && 'on-page')}>
      <a className="sr-only focus:not-sr-only" href="#composer-input">
        Skip to message input
      </a>
      <AppSidebar
        open={railOpen}
        mobile={mobile}
        onClose={closeSide}
        conversations={conversations}
        activeId={activeId}
        onNewChat={newChat}
        onSelect={openChat}
        onDelete={deleteChat}
        onRename={renameChat}
        currentPage={page?.label ?? null}
        onClearAll={clearAll}
        theme={theme}
        onTheme={setTheme}
        onInfo={setInfo}
      />

      <div className="cg-main">
        <header className="cg-top">
          {!railOpen && (
            <IconButton label="Open sidebar" onClick={openSide}>
              <PanelLeft />
            </IconButton>
          )}
          {!railOpen && !mobile && (
            <IconButton label="New chat" onClick={newChat}>
              <SquarePen />
            </IconButton>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="cg-title" aria-label="Taproot Atlas menu">
                <span>Taproot Atlas</span>
                <span className="cg-title-sub">{page ? page.label : 'Public water record'}</span>
                <ChevronDown className="cg-title-chev" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="cg-menu w-72">
              <DropdownMenuLabel className="cg-menu-head">
                <b>Taproot Atlas</b>
                <span>Answers from US EPA water records: SDWIS, Lead &amp; Copper and UCMR 5.</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setPaletteOpen(true)}>
                <CommandIcon className="size-4" /> Quick ask
                <DropdownMenuShortcut>Ctrl K</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setInfo('how')}>
                <Info className="size-4" /> How Taproot works
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setInfo('privacy')}>
                <Shield className="size-4" /> Your privacy
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setInfo('keys')}>
                <Keyboard className="size-4" /> Keyboard shortcuts
                <DropdownMenuShortcut>Ctrl /</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {APP_PAGES.map(({ href, label, hint, icon: Icon }) => (
                <DropdownMenuItem key={href} onSelect={() => (window.location.hash = href)}>
                  <Icon className="size-4" />
                  <span className="flex-1">{label}</span>
                  <span className="cg-menu-hint">{hint}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="flex-1" />
          {mobile && (!empty || page) && (
            <IconButton label="New chat" onClick={newChat}>
              <SquarePen />
            </IconButton>
          )}
          <IconButton label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setTheme(dark ? 'light' : 'dark')}>
            {dark ? <Sun /> : <Moon />}
          </IconButton>
        </header>

        {page ? (
          <main className="cg-page scrollbar-thin" aria-label={page.label}>
            {page.node}
          </main>
        ) : empty ? (
          <main className={cn('cg-empty', leaving && 'landing-dissolve-out')}>
            <WaterSurface />
            <div className="cg-empty-inner stagger-entrance">
              <span className="cg-hello-mark" style={{ ['--stagger-index' as string]: 0 }} aria-hidden="true">
                <WaterMark size={40} />
              </span>
              <h1 style={{ ['--stagger-index' as string]: 0 }}>Where does your tap water come from?</h1>
              <div style={{ ['--stagger-index' as string]: 1 }}>
                <Composer {...composerProps} label="Ask about your tap water" autoFocus foot={null} />
              </div>
              <div style={{ ['--stagger-index' as string]: 2 }} className="cg-chips" role="group" aria-label="Example questions">
                {SUGGESTIONS.map(({ q, hint }) => (
                  <button key={q} type="button" onClick={() => send(q)} aria-label={q} title={hint}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <p className="cg-empty-foot">{foot}</p>
          </main>
        ) : (
          <main id="chat" className="animate-chat-surface-in flex min-h-0 flex-1 flex-col">
            <ChatPane
              messages={messages}
              busy={busy}
              onFollowUp={send}
              onRegenerate={regenerate}
              onEdit={editAndResend}
              composer={<Composer {...composerProps} label="Message Taproot" placeholder="Ask a follow-up" foot={foot} />}
            />
          </main>
        )}
      </div>

      <InfoDialogs open={info} onOpenChange={setInfo} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onPick={(q) => send(q)} />
    </div>
  );
}
