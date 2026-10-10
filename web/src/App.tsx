import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { askTapWater } from './api';
import { ChatPane, type ChatMsg } from './components/chat-pane';
import { InfoDialogs, type InfoDialogKind } from './components/chat/info-dialogs';
import { CommandPalette, useCommandPalette } from './components/command-palette';
import { Composer } from './components/composer';
import { Logo } from './components/Logo';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from './components/tremor';
import { cn } from './lib/utils';
import { RcArrow, RcChevRight, RcClose, RcMenu, RcMoon, RcPlus, RcSun, RcTrash } from './components/chat/rc-icons';
import './styles/record-chat.css';

let nextId = 1;

const EXAMPLES = [
  'Is Flint water safe?',
  'Is there lead in Chicago water?',
  'Does Denver water have PFAS?',
  'Where does Jackson MS water come from?',
];

const EXPLORE = [
  ['#/triage', 'Triage queue', 'For water teams: where to look first'],
  ['#/impact', 'How accurate is it?', 'Checked against what happened'],
  ['#/global', 'Beyond the U.S.', 'Ireland and the open record format'],
  ['#/study', 'Help test Taproot', 'Ten minutes, anonymous'],
] as const;

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
  buttonRef,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button ref={buttonRef} type="button" onClick={onClick} aria-label={label} className="rc-btn quiet">
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
  // Synchronous lock: two Enters in the same frame both see busy=false.
  const busyRef = useRef(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const lastQuestion = useRef('');

  const empty = messages.length === 0;
  const contextPwsid =
    [...messages].reverse().find((m) => m.role === 'assistant' && m.answer && m.answer.scope === 'water' && m.answer.pwsid !== 'UNKNOWN')?.answer
      ?.pwsid ?? undefined;

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Private mode: history stays in memory only.
    }
  }, [history]);

  async function run(q: string, pinPwsid?: string) {
    const controller = new AbortController();
    abortRef.current = controller;
    busyRef.current = true;
    setBusy(true);
    lastQuestion.current = q;
    setMessages((m) => [...m.map((x) => ({ ...x, fresh: false })), { id: nextId++, role: 'user', text: q, at: Date.now() }]);
    setInput('');
    setHistory((h) => [q, ...h.filter((x) => x !== q)].slice(0, 10));
    const started = performance.now();
    try {
      const answer = await askTapWater(q, {
        signal: controller.signal,
        ...(coords ? { lat: coords.lat, lon: coords.lon } : {}),
        ...(contextPwsid ? { contextPwsid } : {}),
        ...(pinPwsid ? { pwsid: pinPwsid } : {}),
      });
      setMessages((m) => [...m, { id: nextId++, role: 'assistant', answer: { ...answer, question: q }, fresh: true, elapsedMs: performance.now() - started }]);
    } catch (e) {
      if (controller.signal.aborted) {
        setMessages((m) => [...m, { id: nextId++, role: 'assistant', stopped: true }]);
      } else {
        const msg = e instanceof Error ? e.message : 'Lookup failed. Check your connection and retry.';
        toast.error(msg, { action: { label: 'Retry', onClick: () => void send(lastQuestion.current) } });
      }
    } finally {
      abortRef.current = null;
      busyRef.current = false;
      setBusy(false);
    }
  }

  function send(question: string, pinPwsid?: string) {
    const q = question.trim().slice(0, 2000);
    if (!q || busy || busyRef.current) return;
    busyRef.current = true;
    if (empty) {
      // America.gov-style hand-off: the start view dissolves, then the
      // conversation surface fades in with the question already placed.
      setLeaving(true);
      window.setTimeout(() => {
        setLeaving(false);
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

  const links = (
    <>
      <button type="button" onClick={() => setInfo('privacy')}>
        Your privacy
      </button>
      <span aria-hidden="true"> · </span>
      <button type="button" onClick={() => setInfo('how')}>
        How Taproot works
      </button>
    </>
  );

  const dark = resolvedTheme === 'dark';

  return (
    <div className="rc-app flex h-dvh flex-col bg-background text-foreground">
      <a className="sr-only focus:not-sr-only" href="#composer-input">
        Skip to message input
      </a>
      <header className="rc-hdr">
        <button type="button" onClick={newChat} className="rc-brand" aria-label="Taproot Atlas, new chat">
          <Logo size={26} />
          <span className="rc-brand-name">Taproot Atlas</span>
          <span className="rc-brand-sub">Public water record</span>
        </button>
        {!empty && (
          <HeaderButton label="New chat" onClick={newChat}>
            <RcPlus />
            <span className="txt">New chat</span>
          </HeaderButton>
        )}
        <HeaderButton label="Menu" buttonRef={menuButtonRef} onClick={() => setMenuOpen(true)}>
          <RcMenu />
          <span className="txt">Menu</span>
        </HeaderButton>
      </header>

      {empty ? (
        <main className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto', leaving && 'landing-dissolve-out')}>
          <div className="rc-home stagger-entrance my-auto">
            <div style={{ ['--stagger-index' as string]: 0 }} className="rc-kick">
              Public water record · United States
            </div>
            <h1 style={{ ['--stagger-index' as string]: 1 }}>
              Ask about the water at any US address <span>— answered from federal records.</span>
            </h1>
            <p style={{ ['--stagger-index' as string]: 2 }} className="rc-home-dek">
              Where it comes from, what tests found in it, and how it reaches you. Every answer is filed with its system ID, source and date.
            </p>
            <div style={{ ['--stagger-index' as string]: 3 }}>
              <Composer {...composerProps} label="Ask about your tap water" autoFocus foot={null} />
            </div>
            <div style={{ ['--stagger-index' as string]: 4 }} className="rc-sugg" aria-label="Example questions" role="group">
              {EXAMPLES.map((q, i) => (
                <button key={q} type="button" onClick={() => send(q)} aria-label={q}>
                  <span className="n" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <b>{q}</b>
                  <RcArrow />
                </button>
              ))}
            </div>
            <p style={{ ['--stagger-index' as string]: 5 }} className="rc-home-foot">
              {links}
            </p>
          </div>
        </main>
      ) : (
        <main id="chat" className="animate-chat-surface-in flex min-h-0 flex-1 flex-col">
          <ChatPane
            messages={messages}
            busy={busy}
            onFollowUp={send}
            composer={
              <Composer
                {...composerProps}
                label="Message"
                foot={
                  <>
                    Answers come from EPA records, not a test of your tap. {links}
                  </>
                }
              />
            }
          />
        </main>
      )}

      <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
        <DrawerContent
          className="rc-drawer gap-0 p-0 sm:p-0"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            menuButtonRef.current?.focus();
          }}
        >
          <DrawerTitle className="sr-only">Menu</DrawerTitle>
          <DrawerDescription className="sr-only">New chat, other Taproot pages, recent questions and display settings</DrawerDescription>
          <div className="rc-drw-h">
            <span className="flex items-center gap-2.5">
              <Logo size={22} />
              <span className="rc-brand-name" style={{ fontSize: 17 }}>
                Taproot Atlas
              </span>
            </span>
            <DrawerClose asChild>
              <button type="button" aria-label="Close menu" className="rc-btn icon ghost">
                <RcClose />
              </button>
            </DrawerClose>
          </div>
          <div className="rc-drw-sec">
            <button type="button" onClick={newChat} className="rc-btn primary w-full" style={{ height: 44 }}>
              <RcPlus /> New chat
            </button>
          </div>
          <div className="rc-drw-sec">
            <span className="rc-lbl">Explore</span>
            <nav aria-label="Explore">
              {EXPLORE.map(([href, label, hint], i) => (
                <a key={href} href={href} onClick={() => setMenuOpen(false)} className="rc-drw-a">
                  <span className="n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0">
                    {label}
                    <span className="h">{hint}</span>
                  </span>
                  <RcChevRight />
                </a>
              ))}
            </nav>
          </div>
          <div className="rc-drw-sec">
            <span className="rc-lbl">Theme</span>
            <div className="rc-seg" role="group" aria-label="Theme">
              <button type="button" aria-pressed={!dark} onClick={() => setTheme('light')}>
                <RcSun /> Day
              </button>
              <button type="button" aria-pressed={dark} onClick={() => setTheme('dark')}>
                <RcMoon /> Night
              </button>
            </div>
          </div>
          <div className="rc-drw-sec">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="rc-lbl">Recent questions</span>
              {history.length > 0 && (
                <button type="button" onClick={() => setHistory([])} aria-label="Clear recent questions" className="rc-btn icon sm ghost">
                  <RcTrash />
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="rc-drw-empty">Your questions stay in this browser.</p>
            ) : (
              <ul>
                {history.map((q, i) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        send(q);
                      }}
                      className="rc-drw-a"
                    >
                      <span className="n">Q{i + 1}</span>
                      <span className="t">{q}</span>
                      <RcArrow />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rc-drw-about">
            <span className="rc-lbl mb-1.5 block">About</span>
            <b>Taproot Atlas</b> reads public US EPA records — SDWIS violations, Lead &amp; Copper results and UCMR 5 PFAS tests — and answers in plain
            language. Reported records only, never a real-time safety verdict.
            <p className="mt-2 flex flex-wrap gap-x-1">{links}</p>
          </div>
        </DrawerContent>
      </Drawer>

      <InfoDialogs open={info} onOpenChange={setInfo} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onPick={(q) => send(q)} />
    </div>
  );
}
