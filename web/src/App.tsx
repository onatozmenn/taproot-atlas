import React, { useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowUp01Icon,
  Attachment01Icon,
  Copy01Icon,
  Mic01Icon,
  Refresh01Icon,
  StopIcon,
  Tick02Icon,
  Location01Icon,
} from '@hugeicons/core-free-icons';
import { askTapWater, type TapAnswer } from './api';
import { suggestFollowUps } from './suggest';
import { AnswerCard, SourcePanel } from './components/Answer';
import { Logo } from './components/Logo';

interface Msg {
  id: number;
  role: 'user' | 'assistant';
  text?: string;
  answer?: TapAnswer;
}

let nextId = 1;

/* ---- inline stroke icons (no emoji) ---- */
/**
 * America.gov-style thinking indicator: "Thinking..." and
 * "Working through your request..." alternate while one word at a time
 * turns bold/dark, sweeping left to right in a loop.
 */
const THINKING_PHRASES = ['Thinking...', 'Working through your request...'];

// Flattened animation steps: [phraseIndex, wordIndex]. Boundary steps are
// repeated so each phrase holds briefly before switching.
const THINKING_STEPS: Array<[number, number]> = (() => {
  const steps: Array<[number, number]> = [];
  THINKING_PHRASES.forEach((phrase, p) => {
    const n = phrase.split(' ').length;
    for (let w = 0; w < n; w++) {
      steps.push([p, w]);
      if (w === 0 || w === n - 1) steps.push([p, w]);
    }
  });
  return steps;
})();

function WorkingIndicator() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const t = setInterval(() => setTick((x) => x + 1), 300);
    return () => clearInterval(t);
  }, []);
  const [pi, wi] = THINKING_STEPS[tick % THINKING_STEPS.length];
  const words = THINKING_PHRASES[pi].split(' ');
  return (
    <div className="working" role="status" aria-label={THINKING_PHRASES[pi]}>
      {words.map((w, i) => (
        <span key={`${pi}-${i}`} className={i === wi ? 'w on' : 'w'}>
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </div>
  );
}

interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  onStop: () => void;
  onVoice: () => void;
  listening: boolean;
  onAttach: (file: File) => void;
  onLocate: () => void;
  locating: boolean;
  coordsActive: boolean;
  placeholder: string;
  inputRef?: { current: HTMLTextAreaElement | null };
  label: string;
}

const COMPOSER_MAX_HEIGHT = 160;

function Composer(p: ComposerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const [multiline, setMultiline] = useState(false);
  const hasText = p.value.trim().length > 0;

  const autosize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    const grown = Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT);
    el.style.height = `${grown}px`;
    el.style.overflowY = el.scrollHeight > COMPOSER_MAX_HEIGHT ? 'auto' : 'hidden';
    setMultiline(grown > el.clientHeight + 4 || el.value.includes('\n'));
  };

  // Shrink back after send clears the value.
  useEffect(() => {
    if (p.value === '') {
      setMultiline(false);
      if (areaRef.current) {
        areaRef.current.style.height = 'auto';
        areaRef.current.style.overflowY = 'hidden';
      }
    }
  }, [p.value]);
  return (
    <form
      className={`composer${multiline ? ' multiline' : ''}`}
      role="search"
      aria-label={p.label}
      onSubmit={(e) => {
        e.preventDefault();
        p.onSubmit();
      }}
    >
      <textarea
        ref={(el) => {
          areaRef.current = el;
          if (p.inputRef) p.inputRef.current = el;
        }}
        rows={1}
        value={p.value}
        onChange={(e) => {
          p.onChange(e.target.value);
          autosize(e.target);
        }}
        onKeyDown={(e) => {
          // Enter sends, Shift+Enter breaks the line (desktop).
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            p.onSubmit();
          }
        }}
        placeholder={p.placeholder}
        aria-label={p.label}
        maxLength={2000}
      />
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.md,.csv,.json"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) p.onAttach(f);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        className="tool-btn"
        aria-label="Attach a text file"
        title="Attach a text file (.txt, .md, .csv, .json)"
        onClick={() => fileRef.current?.click()}
      >
        <HugeiconsIcon icon={Attachment01Icon} size={21} />
      </button>
      <button
        type="button"
        className={`tool-btn${p.listening ? ' live' : ''}`}
        aria-label={p.listening ? 'Listening…' : 'Ask by voice'}
        title="Ask by voice"
        onClick={p.onVoice}
      >
        <HugeiconsIcon icon={Mic01Icon} size={21} />
      </button>
      <button
        type="button"
        className={`tool-btn${p.coordsActive ? ' live' : ''}`}
        aria-label={p.coordsActive ? 'Location on — tap to turn off' : 'Use my location'}
        title={p.coordsActive ? 'Location on — tap to turn off' : 'Use my location'}
        aria-pressed={p.coordsActive}
        onClick={p.onLocate}
        disabled={p.locating}
      >
        <HugeiconsIcon icon={Location01Icon} size={21} />
      </button>
      {p.busy ? (
        <button type="button" className="send-btn working" aria-label="Stop" title="Stop" onClick={p.onStop}>
          <HugeiconsIcon icon={StopIcon} size={15} />
        </button>
      ) : (
        <button
          type="submit"
          className={`send-btn${hasText ? ' ready' : ''}`}
          disabled={!hasText}
          aria-label="Send"
          title="Send"
        >
          <HugeiconsIcon icon={ArrowUp01Icon} size={20} />
        </button>
      )}
    </form>
  );
}

export default function App() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastQuestion = useRef('');

  async function send(question: string) {
    const q = question.trim().slice(0, 2000);
    if (!q || busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    lastQuestion.current = q;
    setMessages((m) => [...m, { id: nextId++, role: 'user', text: q }]);
    setInput('');
    try {
      const answer = await askTapWater(q, {
        signal: controller.signal,
        ...(coords ? { lat: coords.lat, lon: coords.lon } : {}),
      });
      setMessages((m) => [...m, { id: nextId++, role: 'assistant', answer }]);
    } catch (e) {
      if (controller.signal.aborted) {
        // User pressed Stop: silently drop the pending turn.
      } else {
        setError(e instanceof Error ? e.message : 'Lookup failed. Check your connection and retry.');
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      requestAnimationFrame(() =>
        boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' }),
      );
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  const empty = messages.length === 0;

  async function copyAnswer(id: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      setCopied(null);
    }
  }

  function toggleLocate() {
    if (coords) {
      setCoords(null);
      return;
    }
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        inputRef.current?.focus();
      },
      () => {
        setLocating(false);
        setError('Could not read your location. Check the browser permission and retry.');
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  }

  function toggleVoice() {
    const SR: unknown =
      (window as unknown as Record<string, unknown>).SpeechRecognition ??
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (typeof SR !== 'function') {
      inputRef.current?.focus();
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
      setError('File is too large. Attach a text file under 200 KB.');
      return;
    }
    try {
      const text = (await file.text()).slice(0, 2000);
      setInput((cur) => `${cur}${cur && !cur.endsWith(' ') ? ' ' : ''}${text}`.slice(0, 2000));
      inputRef.current?.focus();
    } catch {
      setError('Could not read that file. Try a .txt, .md, .csv or .json file.');
    }
  }

  const submit = () => void send(input);

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

  return (
    <div className="page">
      <a className="skip-link" href="#chat">Skip to conversation</a>

      <header className="topbar">
        <a className="brand" href="/" aria-label="Taproot Atlas, reload homepage">
          <Logo size={26} />
          <span className="wordmark">Taproot Atlas</span>
        </a>
        {!empty && (
          <button
            className="restart-btn"
            type="button"
            aria-label="Start over"
            title="Start over"
            onClick={() => {
              stop();
              setMessages([]);
              setError(null);
            }}
          >
            <HugeiconsIcon icon={Refresh01Icon} size={28} strokeWidth={2.2} />
          </button>
        )}
      </header>

      <main className="chat" ref={boxRef} id="chat" aria-live="polite">
        {empty ? (
          <div className="hero">
            <h1>Where does your tap water come from, what's in it, how does it reach you?</h1>
            <p className="lede">Source basins, reported lab results with EPA compliance, and the schematic source-to-tap pathway. Start here.</p>
            <div className="hero-composer">
              <Composer
                value={input}
                onChange={setInput}
                onSubmit={submit}
                busy={false}
                onStop={stop}
                onVoice={toggleVoice}
                listening={listening}
                onAttach={attachFile}
                onLocate={toggleLocate}
                locating={locating}
                coordsActive={coords !== null}
                placeholder="Ask Taproot"
                inputRef={inputRef}
                label="Ask about your tap water"
              />
            </div>
          </div>
        ) : (
          <>
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="bubble-row user-row">
                  <div className="bubble user-bubble">{m.text}</div>
                </div>
              ) : (
                <div key={m.id} className="assistant-block">
                  {m.answer && <AnswerCard answer={m.answer} />}
                  {m.answer && m.answer.scope !== 'redirect' && chipsFor(m.answer).length > 0 && (
                    <div className="chip-row" aria-label="Suggested follow-ups">
                      {chipsFor(m.answer).map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          className="chip"
                          disabled={busy}
                          onClick={() => void send(chip)}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="attrib" aria-label="Answer actions">
                    {m.answer && m.answer.scope !== 'redirect' && <SourcePanel answer={m.answer} />}
                    <button
                      type="button"
                      className="icon-pill solo"
                      aria-label="Copy"
                      title={copied === m.id ? 'Copied' : 'Copy answer'}
                      onClick={() => m.answer && void copyAnswer(m.id, m.answer.overview)}
                    >
                      {copied === m.id ? <HugeiconsIcon icon={Tick02Icon} size={17} /> : <HugeiconsIcon icon={Copy01Icon} size={17} />}
                    </button>
                  </div>
                </div>
              ),
            )}
            {busy && <WorkingIndicator />}
          </>
        )}
        {error && (
          <div className="error-box" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => void send(lastQuestion.current)}>Retry</button>
          </div>
        )}
      </main>

      {!empty && (
        <footer className="composer-wrap">
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={submit}
            busy={busy}
            onStop={stop}
            onVoice={toggleVoice}
            listening={listening}
            onAttach={attachFile}
                onLocate={toggleLocate}
                locating={locating}
                coordsActive={coords !== null}
            placeholder="Ask Taproot"
            label="Ask a follow-up"
          />
          <p className="foot-note">
            Demonstration snapshot · EPA / NYC open data · Reports only. Never a safety verdict. Verify at the
            official source.
          </p>
        </footer>
      )}
    </div>
  );
}
