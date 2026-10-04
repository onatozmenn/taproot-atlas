import React, { useRef, useState } from 'react';
import { askTapWater, type TapAnswer } from './api';
import { AnswerCard } from './components/Answer';
import { suggestFollowUps } from './suggest';

interface Msg {
  id: number;
  role: 'user' | 'assistant';
  text?: string;
  answer?: TapAnswer;
}

const STARTERS = [
  'Where does my tap water come from?',
  'Show the watershed map',
  'Any violations in the last 5 years?',
];

let nextId = 1;

export default function App() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const lastQuestion = useRef('');

  async function send(question: string) {
    const q = question.trim();
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
      <header className="topbar">
        <div className="brand">
          <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true" className="flag">
            <rect width="26" height="18" rx="2" fill="#fff" stroke="#d0d0d0" />
            {Array.from({ length: 7 }).map((_, i) => (
              <rect key={i} y={i * 2.6} width="26" height="1.3" fill={i % 2 === 0 ? '#b31942' : '#fff'} />
            ))}
            <rect width="11" height="9" fill="#0a3161" />
          </svg>
          <span className="wordmark">Taproot Atlas</span>
          <span className="tag">Xylem Innovation Challenge</span>
        </div>
        <button className="menu-btn" type="button">Menu</button>
      </header>

      <main className="chat" ref={boxRef} id="chat" aria-live="polite">
        {empty ? (
          <div className="hero">
            <h1>Where does your tap water come from?</h1>
            <p>
              Ask in everyday words. Answers cite the public water system, source basins,
              reported lab tests, and EPA compliance records — shown on a schematic map.
            </p>
            <div className="chips">
              {STARTERS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
            <p className="fine">
              Include a city or system name if it helps, but no names, addresses, or personal details.
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
                    <button type="button" aria-label="Helpful">Helpful</button>
                    <button type="button" aria-label="Not helpful">Not helpful</button>
                    <button type="button" aria-label="Copy">Copy</button>
                  </div>
                </div>
              ),
            )}
            {!empty && !busy && (
              <div className="chips">
                {chips.map((s) => (
                  <button key={s} type="button" className="chip" onClick={() => void send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {busy && <div className="typing">Looking up EPA / NYC records…</div>}
        {error && (
          <div className="error-box" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => void send(lastQuestion.current)}>Retry</button>
          </div>
        )}
      </main>

      <footer className="composer-wrap">
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything…"
            aria-label="Ask about your tap water"
          />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send">
            →
          </button>
        </form>
        <p className="foot-note">Reports only — never a safety verdict. Schematic map, not engineering.</p>
      </footer>
    </div>
  );
}
