import React, { useEffect, useRef, useState } from 'react';
import { askTapWater, type TapAnswer } from './api';
import { AnswerCard } from './components/Answer';
import { Logo } from './components/Logo';

interface Msg {
  id: number;
  role: 'user' | 'assistant';
  text?: string;
  answer?: TapAnswer;
}

let nextId = 1;

/* ---- inline stroke icons (no emoji) ---- */
function IconClip() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21 12.5-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8L13 5a3.7 3.7 0 0 1 5.2 5.2l-8.2 8.2a1.85 1.85 0 0 1-2.6-2.6L14.5 8.7" />
    </svg>
  );
}
function IconMic() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
function IconArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}
function IconStop() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
    </svg>
  );
}
function IconThumbUp() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Zm2-1 3.5-7a2 2 0 0 1 3.6 1.7L14.5 9H19a2 2 0 0 1 2 2.4l-1.5 7A2 2 0 0 1 17.5 20H9" />
    </svg>
  );
}
function IconThumbDown() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3Zm-2 1-3.5 7a2 2 0 0 1-3.6-1.7l1.6-4.3H5a2 2 0 0 1-2-2.4l1.5-7A2 2 0 0 1 6.5 4H15" />
    </svg>
  );
}
function IconCopy() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m4 12.5 5 5L20 6.5" />
    </svg>
  );
}

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
  placeholder: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  label: string;
}

function Composer(p: ComposerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const hasText = p.value.trim().length > 0;
  return (
    <form
      className="composer"
      role="search"
      aria-label={p.label}
      onSubmit={(e) => {
        e.preventDefault();
        p.onSubmit();
      }}
    >
      <input
        ref={p.inputRef as React.RefObject<HTMLInputElement>}
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
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
        <IconClip />
      </button>
      <button
        type="button"
        className={`tool-btn${p.listening ? ' live' : ''}`}
        aria-label={p.listening ? 'Listening…' : 'Ask by voice'}
        title="Ask by voice"
        onClick={p.onVoice}
      >
        <IconMic />
      </button>
      {p.busy ? (
        <button type="button" className="send-btn working" aria-label="Stop" title="Stop" onClick={p.onStop}>
          <IconStop />
        </button>
      ) : (
        <button
          type="submit"
          className={`send-btn${hasText ? ' ready' : ''}`}
          disabled={!hasText}
          aria-label="Send"
          title="Send"
        >
          <IconArrow />
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
  const [feedback, setFeedback] = useState<Record<number, 'helpful' | 'not-helpful' | null>>({});
  const [copied, setCopied] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
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
      const answer = await askTapWater(q, { signal: controller.signal });
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
      requestAnimationFrame(() => boxRef.current?.scrollTo({ top: 99999 }));
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

  return (
    <div className="page">
      <a className="skip-link" href="#chat">Skip to conversation</a>

      <header className="topbar">
        <div className="brand">
          <Logo size={26} />
          <span className="wordmark">Taproot Atlas</span>
        </div>
        {!empty && (
          <button
            className="ghost-btn"
            type="button"
            onClick={() => {
              stop();
              setMessages([]);
              setError(null);
            }}
          >
            Start over
          </button>
        )}
      </header>

      <main className="chat" ref={boxRef} id="chat" aria-live="polite">
        {empty ? (
          <div className="hero">
            <h1>Hello — where does your tap water come from?</h1>
            <p className="lede">Whatever you need to know about your water, start here.</p>
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
                placeholder="Ask anything…"
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
                  <div className="attrib" aria-label="Answer actions">
                    {m.answer && m.answer.scope !== 'redirect' && (
                      <span className="source-pill" title={`${m.answer.systemName} · ${m.answer.pwsid}`}>
                        <Logo size={15} />
                        {m.answer.pwsid === 'UNKNOWN' ? 'Unverified area' : `${m.answer.systemName} · ${m.answer.pwsid}`}
                      </span>
                    )}
                    <span className="icon-pill" role="group" aria-label="Rate this answer">
                      <button
                        type="button"
                        aria-label="Helpful"
                        aria-pressed={feedback[m.id] === 'helpful'}
                        className={feedback[m.id] === 'helpful' ? 'active' : ''}
                        onClick={() => setFeedback((f) => ({ ...f, [m.id]: 'helpful' }))}
                      >
                        <IconThumbUp />
                      </button>
                      <button
                        type="button"
                        aria-label="Not helpful"
                        aria-pressed={feedback[m.id] === 'not-helpful'}
                        className={feedback[m.id] === 'not-helpful' ? 'active' : ''}
                        onClick={() => setFeedback((f) => ({ ...f, [m.id]: 'not-helpful' }))}
                      >
                        <IconThumbDown />
                      </button>
                    </span>
                    <button
                      type="button"
                      className="icon-pill solo"
                      aria-label="Copy"
                      title={copied === m.id ? 'Copied' : 'Copy answer'}
                      onClick={() => m.answer && void copyAnswer(m.id, m.answer.overview)}
                    >
                      {copied === m.id ? <IconCheck /> : <IconCopy />}
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
            placeholder="Ask anything…"
            label="Ask a follow-up"
          />
          <p className="foot-note">
            Demonstration snapshot · EPA / NYC open data · Reports only — never a safety verdict. Verify at the
            official source.
          </p>
        </footer>
      )}
    </div>
  );
}
