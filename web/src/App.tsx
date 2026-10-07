import { Map as MapIcon, MoonIcon, SunIcon } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { askTapWater, type TapAnswer } from './api';
import { suggestFollowUps } from './suggest';
import { AppSidebar } from './components/app-sidebar';
import { AtlasPanel, type AtlasTab } from './components/atlas/atlas-panel';
import { ChatPane, type ChatMsg } from './components/chat-pane';
import { CommandPalette, CommandPaletteButton, useCommandPalette } from './components/command-palette';
import { Composer } from './components/composer';
import { Suggestion, Suggestions } from './components/ai-elements/suggestion';
import { Button } from './components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './components/ui/sheet';
import { SidebarInset, SidebarProvider, SidebarTrigger } from './components/ui/sidebar';
import { useIsMobile } from './hooks/use-mobile';

let nextId = 1;

const LANDING_EXAMPLES = [
  'Where does Chicago tap water come from?',
  'Any violations in the last 5 years?',
  'Los Angeles water?',
  'How does my water reach my tap?',
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

function tabHintForChip(chip: string): AtlasTab | null {
  const c = chip.toLowerCase();
  if (c.includes('watershed map') || c.includes('map')) return 'pathway';
  if (c.includes('violation')) return 'compliance';
  if (c.includes('report') || c.includes('test')) return 'quality';
  return null;
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
    >
      {dark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </Button>
  );
}

export default function App() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [history, setHistory] = useState<string[]>(loadHistory);
  const [atlasTab, setAtlasTab] = useState<AtlasTab>('source');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useCommandPalette();
  const isMobile = useIsMobile();
  const abortRef = useRef<AbortController | null>(null);
  const lastQuestion = useRef('');
  const tabHint = useRef<AtlasTab | null>(null);

  const empty = messages.length === 0;
  const latestAnswer = [...messages].reverse().find((m) => m.role === 'assistant' && m.answer)?.answer ?? null;

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Private mode: history stays in memory only.
    }
  }, [history]);

  async function send(question: string) {
    const q = question.trim().slice(0, 2000);
    if (!q || busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    lastQuestion.current = q;
    setMessages((m) => [...m, { id: nextId++, role: 'user', text: q }]);
    setInput('');
    setHistory((h) => [q, ...h.filter((x) => x !== q)].slice(0, 10));
    try {
      const answer = await askTapWater(q, {
        signal: controller.signal,
        ...(coords ? { lat: coords.lat, lon: coords.lon } : {}),
      });
      setMessages((m) => [...m, { id: nextId++, role: 'assistant', answer }]);
      setAtlasTab(tabHint.current ?? 'source');
      if (isMobile) setSheetOpen(true);
    } catch (e) {
      if (controller.signal.aborted) {
        // User pressed Stop: silently drop the pending turn.
      } else {
        const msg = e instanceof Error ? e.message : 'Lookup failed. Check your connection and retry.';
        toast.error(msg, { action: { label: 'Retry', onClick: () => void send(lastQuestion.current) } });
      }
    } finally {
      tabHint.current = null;
      abortRef.current = null;
      setBusy(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function newQuery() {
    stop();
    setMessages([]);
    setInput('');
  }

  function onChip(chip: string) {
    // The watershed-map chip only switches the Atlas panel to the Pathway
    // tab: re-asking would just re-append a full copy of the previous answer.
    if (chip.toLowerCase().includes('watershed map')) {
      setAtlasTab('pathway');
      if (isMobile) setSheetOpen(true);
      return;
    }
    tabHint.current = tabHintForChip(chip);
    void send(chip);
  }

  function chipsFor(answer: TapAnswer): string[] {
    if (answer.scope === 'redirect') return [];
    return suggestFollowUps({
      violations: answer.violations,
      windowStart: answer.windowStart,
      windowEnd: answer.windowEnd,
      boundaryType: answer.boundaryType,
      metrics: answer.metrics.map((m) => ({ parameter: m.parameter, reportPeriod: m.provenance.reportPeriod })),
    });
  }

  function toggleLocate() {
    if (coords) {
      setCoords(null);
      return;
    }
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        toast.success('Location on. It will be sent with your next question.');
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
        if (text) void send(text);
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
    onSend: (t: string) => void send(t),
    busy,
    onStop: stop,
    onAttachFile: attachFile,
    onVoice: toggleVoice,
    listening,
    onLocate: toggleLocate,
    locating,
    coordsActive: coords !== null,
  };

  return (
    <SidebarProvider>
      <AppSidebar history={history} onNewQuery={newQuery} onHistorySelect={(q) => void send(q)} />
      <SidebarInset>
        <a className="sr-only focus:not-sr-only" href="#chat">
          Skip to conversation
        </a>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur">
          <SidebarTrigger aria-label="Toggle sidebar" />
          <span className="font-display text-lg font-medium md:hidden">Taproot Atlas</span>
          <div className="ml-auto flex items-center gap-1.5">
            {latestAnswer && isMobile && (
              <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
                <MapIcon className="mr-1 size-4" /> Atlas
              </Button>
            )}
            <span className="hidden sm:block">
              <CommandPaletteButton onClick={() => setPaletteOpen(true)} />
            </span>
            <ThemeToggle />
          </div>
        </header>

        {empty ? (
          <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
            <div className="text-center">
              <h1 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
                Where does your tap water come from, what&apos;s in it, how does it reach you?
              </h1>
              <p className="mt-3 text-muted-foreground">
                Source basins, reported lab results with EPA compliance, and the schematic source-to-tap
                pathway. Start here.
              </p>
            </div>
            <div className="w-full">
              <Composer {...composerProps} label="Ask about your tap water" />
            </div>
            <Suggestions aria-label="Example questions">
              {LANDING_EXAMPLES.map((q) => (
                <Suggestion key={q} suggestion={q} disabled={busy} onClick={(s) => void send(s)} />
              ))}
            </Suggestions>
          </main>
        ) : (
          <main id="chat" aria-live="polite" className="flex min-h-0 flex-1 gap-0">
            <div className="flex min-h-0 min-w-0 flex-1 basis-[40%] flex-col">
              <ChatPane
                messages={messages}
                {...composerProps}
                label="Ask a follow-up"
                chipsFor={chipsFor}
                onChip={(chip) => onChip(chip)}
              />
            </div>
            <aside className="hidden min-h-0 w-[60%] min-w-0 flex-col border-l md:flex" aria-label="Atlas panel">
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <AtlasPanel answer={latestAnswer} tab={atlasTab} onTabChange={setAtlasTab} loading={busy} />
              </div>
            </aside>
          </main>
        )}

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto" aria-label="Atlas panel">
            <SheetHeader>
              <SheetTitle className="font-display">Atlas</SheetTitle>
            </SheetHeader>
            <div className="mt-3">
              <AtlasPanel answer={latestAnswer} tab={atlasTab} onTabChange={setAtlasTab} loading={busy} />
            </div>
          </SheetContent>
        </Sheet>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onPick={(q) => void send(q)} />
      </SidebarInset>
    </SidebarProvider>
  );
}
