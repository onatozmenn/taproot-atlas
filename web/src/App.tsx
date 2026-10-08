import { HistoryIcon, MenuIcon, MoonIcon, SquarePenIcon, SunIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { askTapWater } from './api';
import { ChatPane, type ChatMsg } from './components/chat-pane';
import { InfoDialogs, type InfoDialogKind } from './components/chat/info-dialogs';
import { CommandPalette, useCommandPalette } from './components/command-palette';
import { Composer } from './components/composer';
import { Logo } from './components/Logo';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './components/ui/sheet';
import { cn } from './lib/utils';

let nextId = 1;

const EXAMPLES = [
  'Where does Chicago tap water come from?',
  'Is there lead in New York City water?',
  'How does Los Angeles water reach my tap?',
  'Any violations in Houston in the last 5 years?',
];

const HISTORY_KEY = 'taproot-history';

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((q): q is string => typeof q === 'string').slice(0, 10) : [];
  } catch {
    return [];
  }
}

function HeaderButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="press inline-flex h-10 items-center gap-2 rounded-full px-3 text-[15px] font-medium hover:bg-secondary"
    >
      {children}
    </button>
  );
}

export default function App() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [listening, setListening] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [history, setHistory] = useState<string[]>(loadHistory);
  const [menuOpen, setMenuOpen] = useState(false);
  const [info, setInfo] = useState<InfoDialogKind>(null);
  const [paletteOpen, setPaletteOpen] = useCommandPalette();
  const { resolvedTheme, setTheme } = useTheme();
  const abortRef = useRef<AbortController | null>(null);
  const lastQuestion = useRef('');

  const empty = messages.length === 0;
  const contextPwsid =
    [...messages].reverse().find((m) => m.role === 'assistant' && m.answer && m.answer.pwsid !== 'UNKNOWN')?.answer
      ?.pwsid ?? undefined;

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Private mode: history stays in memory only.
    }
  }, [history]);

  async function run(q: string) {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    lastQuestion.current = q;
    setMessages((m) => [...m.map((x) => ({ ...x, fresh: false })), { id: nextId++, role: 'user', text: q }]);
    setInput('');
    setHistory((h) => [q, ...h.filter((x) => x !== q)].slice(0, 10));
    const started = performance.now();
    try {
      const answer = await askTapWater(q, {
        signal: controller.signal,
        ...(coords ? { lat: coords.lat, lon: coords.lon } : {}),
        ...(contextPwsid ? { contextPwsid } : {}),
      });
      setMessages((m) => [...m, { id: nextId++, role: 'assistant', answer: { ...answer, question: q }, fresh: true, elapsedMs: performance.now() - started }]);
    } catch (e) {
      if (!controller.signal.aborted) {
        const msg = e instanceof Error ? e.message : 'Lookup failed. Check your connection and retry.';
        toast.error(msg, { action: { label: 'Retry', onClick: () => void send(lastQuestion.current) } });
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function send(question: string) {
    const q = question.trim().slice(0, 2000);
    if (!q || busy) return;
    if (empty) {
      // America.gov-style hand-off: the start view dissolves, then the
      // conversation surface fades in with the question already placed.
      setLeaving(true);
      window.setTimeout(() => {
        setLeaving(false);
        void run(q);
      }, 220);
      return;
    }
    void run(q);
  }

  function stop() {
    abortRef.current?.abort();
  }

  function newChat() {
    stop();
    setMessages([]);
    setInput('');
    setMenuOpen(false);
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

  const notice = (
    <p className="mb-2 text-center text-[13px] text-muted-foreground">
      <button type="button" className="underline-offset-4 hover:underline" onClick={() => setInfo('privacy')}>
        Your privacy
      </button>
      <span aria-hidden="true"> · </span>
      <button type="button" className="underline-offset-4 hover:underline" onClick={() => setInfo('how')}>
        How Taproot works
      </button>
    </p>
  );

  return (
    <div className="flex h-dvh flex-col bg-background">
      <a className="sr-only focus:not-sr-only" href="#composer-input">
        Skip to message input
      </a>
      <header className="z-20 flex h-16 shrink-0 items-center gap-2 px-4 sm:px-6">
        <button type="button" onClick={newChat} className="press flex items-center gap-2.5 rounded-full pr-2" aria-label="Taproot Atlas, new chat">
          <Logo size={28} />
          <span className="font-display text-[22px] font-medium tracking-tight">Taproot Atlas</span>
        </button>
        <div className="ml-auto flex items-center gap-1">
          {!empty && (
            <HeaderButton label="New chat" onClick={newChat}>
              <SquarePenIcon className="size-[18px]" />
              <span className="hidden sm:inline">New chat</span>
            </HeaderButton>
          )}
          <HeaderButton label="Menu" onClick={() => setMenuOpen(true)}>
            <MenuIcon className="size-[18px]" />
            <span className="hidden sm:inline">Menu</span>
          </HeaderButton>
        </div>
      </header>

      {empty ? (
        <main
          className={cn(
            'mx-auto flex w-full max-w-[672px] flex-1 flex-col justify-center px-5 pb-16',
            leaving && 'landing-dissolve-out',
          )}
        >
          <div className="stagger-entrance">
            <h1 style={{ ['--stagger-index' as string]: 0 }} className="font-display text-[40px] font-normal leading-[1.1] tracking-tight sm:text-[52px]">
              Ask about your tap water.
            </h1>
            <p style={{ ['--stagger-index' as string]: 1 }} className="mt-3 text-[17px] text-muted-foreground">
              Where it comes from, what tests found in it, and how it reaches you. Answers come only from public EPA and
              utility records.
            </p>
            <div style={{ ['--stagger-index' as string]: 2 }} className="mt-8">
              <Composer {...composerProps} label="Ask about your tap water" placeholder="Ask about a city's tap water…" autoFocus />
            </div>
            <div style={{ ['--stagger-index' as string]: 3 }} className="mt-5 flex flex-wrap gap-2.5" aria-label="Example questions">
              {EXAMPLES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="press min-h-11 rounded-[40px] border border-border px-4 py-2 text-left text-[15px] hover:border-foreground/40 hover:bg-secondary"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </main>
      ) : (
        <main id="chat" className="animate-chat-surface-in flex min-h-0 flex-1 flex-col">
          <ChatPane messages={messages} busy={busy} onFollowUp={send} />
          <div className="shrink-0 bg-gradient-to-t from-background from-70% to-transparent px-4 pb-4 pt-2">
            <div className="mx-auto w-full max-w-[672px]">
              {notice}
              <Composer {...composerProps} label="Message" />
            </div>
          </div>
        </main>
      )}

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="w-[320px] gap-0 sm:max-w-[360px]">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl font-medium">Menu</SheetTitle>
            <SheetDescription className="sr-only">New chat, recent questions and display settings</SheetDescription>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-3">
            <button type="button" onClick={newChat} className="press flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-secondary">
              <SquarePenIcon className="size-[18px]" /> New chat
            </button>
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="press flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-secondary"
            >
              {resolvedTheme === 'dark' ? <SunIcon className="size-[18px]" /> : <MoonIcon className="size-[18px]" />}
              {resolvedTheme === 'dark' ? 'Light theme' : 'Dark theme'}
            </button>
          </nav>
          <div className="mt-4 border-t px-3 pt-4">
            <div className="flex items-center justify-between px-3 pb-2">
              <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <HistoryIcon className="size-4" /> Recent questions
              </h3>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHistory([])}
                  aria-label="Clear recent questions"
                  className="press inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
                >
                  <Trash2Icon className="size-4" />
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="px-3 text-sm text-muted-foreground">Your questions stay in this browser.</p>
            ) : (
              <ul className="flex flex-col">
                {history.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        send(q);
                      }}
                      className="press w-full truncate rounded-2xl px-3 py-2 text-left text-[15px] hover:bg-secondary"
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-auto border-t p-4 text-[13px] text-muted-foreground">
            <button type="button" className="hover:underline" onClick={() => setInfo('privacy')}>
              Your privacy
            </button>
            <span aria-hidden="true"> · </span>
            <button type="button" className="hover:underline" onClick={() => setInfo('how')}>
              How Taproot works
            </button>
            <p className="mt-2">Reported records only. Never a real-time safety verdict.</p>
          </div>
        </SheetContent>
      </Sheet>

      <InfoDialogs open={info} onOpenChange={setInfo} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onPick={(q) => send(q)} />
    </div>
  );
}
