import React, { useEffect, useRef, useState } from 'react';
import { askTapWater, type TapAnswer } from './api';
import { AnswerCard } from './components/Answer';
import { Logo } from './components/Logo';
import { suggestFollowUps } from './suggest';

interface Msg {
  id: number;
  role: 'user' | 'assistant';
  text?: string;
  answer?: TapAnswer;
}

const STARTERS = [
  'Where does my tap water come from?',
  'Any violations in the last 5 years?',
  'What did the 2024 Annual report test?',
];

const PLACEHOLDERS = [
  'Ask where your tap water comes from…',
  'Help me check violations in the last 5 years…',
  'What did the 2024 Annual report test…',
];

let nextId = 1;

export default function App() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, 'helpful' | 'not-helpful' | null>>({});
  const [copied, setCopied] = useState<number | null>(null);
  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);
  const [listening, setListening] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastQuestion = useRef('');

  useEffect(() => {
    if (messages.length > 0) return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % PLACEHOLDERS.length;
      setPlaceholder(PLACEHOLDERS[i]);
    }, 4000);
    return () => clearInterval(t);
  }, [messages.length]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  async function send(question: string) {
    const q = question.trim().slice(0, 2000);
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    lastQuestion.current = q;
    setMessages((m) => [...m, { id: nextId++, role: 'user', text: q }]);
    setInput('');
    try {
      const answer = await askTapWater(q);
      setMessages((m) => [...m, { id: nextId++, role: 'assistant', answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed. Check your connection and retry.');
    } finally {
      setBusy(false);
      requestAnimationFrame(() => boxRef.current?.scrollTo({ top: 99999 }));
    }
  }

  const empty = messages.length === 0;
  const lastAnswer = [...messages].reverse().find((m) => m.answer)?.answer;

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
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      inputRef.current?.focus();
      return;
    }
    try {
      const rec = new SR();
      rec.lang = 'en-US';
      rec.interimResults = false;
      setListening(true);
      rec.onresult = (e: any) => {
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

  const chips = lastAnswer
    ? suggestFollowUps({
        violations: lastAnswer.violations,
        windowStart: lastAnswer.windowStart,
        windowEnd: lastAnswer.windowEnd,
        boundaryType: lastAnswer.boundaryType,
        metrics: lastAnswer.metrics.map((m) => ({
          parameter: m.parameter,
          reportPeriod: m.provenance.reportPeriod,
        })),
      })
    : STARTERS;

  return (
    <div className="page">
      <a className="skip-link" href="#chat">Skip to conversation</a>

      <div className="official-strip" role="note">
        <span className="dot" aria-hidden="true" />
        <span>
          Demonstration snapshot · EPA / NYC open data · No account, no search history, no precise location
        </span>
      </div>

      <header className="topbar">
        <div className="brand">
          <Logo size={30} />
          <span className="wordmark">Taproot Atlas</span>
          <span className="tag">Water snapshot</span>
        </div>
        <button
          className="menu-btn"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          Menu
        </button>
      </header>
      {menuOpen && (
        <nav className="menu-panel" id="site-menu" aria-label="Site menu">
          <a href="https://echo.epa.gov/" target="_blank" rel="noreferrer">EPA ECHO</a>
          <a href="https://www.nyc.gov/site/dep/water/drinking-water.page" target="_blank" rel="noreferrer">
            NYC DEP drinking water
          </a>
          <a href="https://www.epa.gov/ground-water-and-drinking-water" target="_blank" rel="noreferrer">
            EPA drinking water
          </a>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setMessages([]);
              setError(null);
              setMenuOpen(false);
            }}
          >
            Start over
          </button>
        </nav>
      )}

      <main className="chat" ref={boxRef} id="chat" aria-live="polite">
        {empty ? (
          <div className="hero">
            <h1>Hello — where does your tap water come from?</h1>
            <p className="lede">Whatever you need to know about your water, start here.</p>
            <form
              className="hero-search"
              role="search"
              aria-label="Ask about tap water"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <span className="search-icon" aria-hidden="true">✦</span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={placeholder}
                aria-label="Ask about your tap water"
                maxLength={2000}
              />
              <button
                type="button"
                className={`icon-btn${listening ? ' live' : ''}`}
                aria-label={listening ? 'Listening…' : 'Ask by voice'}
                title="Ask by voice"
                onClick={toggleVoice}
              >
                🎙
              </button>
              <button
                type="submit"
                className="send-btn"
                disabled={busy || !input.trim()}
                aria-label="Send"
                title="Send"
              >
                ↑
              </button>
            </form>
            <div className="try-row" aria-label="Try asking">
              <span className="try-label">Try</span>
              {STARTERS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
            <p className="privacy">
              Share only what&rsquo;s needed · Approximate area only · Answers cite official records
            </p>
          </div>
        ) : (
          <>
            <div className="thread-actions">
              <button type="button" className="ghost-btn" onClick={() => { setMessages([]); setError(null); }}>
                Start over
              </button>
            </div>
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="bubble-row user-row">
                  <div className="bubble user-bubble">{m.text}</div>
                </div>
              ) : (
                <div key={m.id} className="assistant-block">
                  {m.answer && <AnswerCard answer={m.answer} />}
                  <div className="feedback">
                    <button
                      type="button"
                      aria-label="Helpful"
                      aria-pressed={feedback[m.id] === 'helpful'}
                      className={feedback[m.id] === 'helpful' ? 'active' : ''}
                      onClick={() => setFeedback((f) => ({ ...f, [m.id]: 'helpful' }))}
                    >
                      Helpful
                    </button>
                    <button
                      type="button"
                      aria-label="Not helpful"
                      aria-pressed={feedback[m.id] === 'not-helpful'}
                      className={feedback[m.id] === 'not-helpful' ? 'active' : ''}
                      onClick={() => setFeedback((f) => ({ ...f, [m.id]: 'not-helpful' }))}
                    >
                      Not helpful
                    </button>
                    <button
                      type="button"
                      aria-label="Copy"
                      onClick={() => m.answer && void copyAnswer(m.id, m.answer.overview)}
                    >
                      {copied === m.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              ),
            )}
            {!busy && (
              <div className="chips" aria-label="Follow-up questions">
                {chips.map((s) => (
                  <button key={s} type="button" className="chip" onClick={() => void send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {busy && <div className="typing" role="status">Looking up official sources…</div>}
        {error && (
          <div className="error-box" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => void send(lastQuestion.current)}>Retry</button>
          </div>
        )}
      </main>

      {!empty && (
        <footer className="composer-wrap">
          <form
            className="composer"
            role="search"
            aria-label="Ask a follow-up"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <span className="search-icon" aria-hidden="true">✦</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              aria-label="Ask about your tap water"
              maxLength={2000}
            />
            <button
              type="button"
              className={`icon-btn${listening ? ' live' : ''}`}
              aria-label={listening ? 'Listening…' : 'Ask by voice'}
              title="Ask by voice"
              onClick={toggleVoice}
            >
              🎙
            </button>
            <button type="submit" className="send-btn" disabled={busy || !input.trim()} aria-label="Send">
              ↑
            </button>
          </form>
          <p className="foot-note">
            Reports only — never a safety verdict. Schematic map, not engineering. Verify at the official source.
          </p>
        </footer>
      )}
    </div>
  );
}
