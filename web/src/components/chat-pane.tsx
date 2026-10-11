import { useCallback, useRef, useState, type ReactNode } from 'react';
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';
import type { TapAnswer } from '../api';
import { AnswerActions, sourcesFor, type SourceLink } from './chat/answer-actions';
import { EvidenceCard } from './chat/evidence-card';
import { StreamingAnswer } from './chat/streaming-answer';
import { LIVE_DELAYS, LIVE_STEPS, traceFor } from './chat/answer-trace';
import { ArrowDown } from 'lucide-react';
import { Logo } from './Logo';
import { ClarifyCard, CitePill, FollowUpList, RecordChips, ThinkingTrace, tagOf, useStages, type RecordChip } from './kit';
import '../styles/record-chat.css';
import '../styles/chatgpt-shell.css';

export interface ChatMsg {
  id: number;
  role: 'user' | 'assistant';
  text?: string;
  answer?: TapAnswer;
  /** True for the answer that just arrived: it streams in and animates. */
  fresh?: boolean;
  /** How long the answer took, measured in the browser. */
  elapsedMs?: number;
  /** The user pressed Stop before an answer arrived. */
  stopped?: boolean;
  /** When the message was made (ms since epoch), for the record label. */
  at?: number;
}

/** The trace while an answer is on its way: a ticking rule, one step per record. */
function LiveTrace() {
  const stage = useStages(LIVE_DELAYS);
  const steps = LIVE_STEPS.slice(0, stage + 1).map((label) => ({ label }));
  return (
    <div className="cg-asst animate-message-in">
      <AssistantMark busy />
      <div className="cg-asst-body">
        <ThinkingTrace steps={steps} working totalSteps={LIVE_STEPS.length} />
      </div>
    </div>
  );
}

/** The small round mark beside every answer. */
function AssistantMark({ busy }: { busy?: boolean }) {
  return (
    <span className={`cg-avatar${busy ? ' busy' : ''}`} aria-hidden="true">
      <Logo size={18} />
    </span>
  );
}

interface ChatPaneProps {
  messages: ChatMsg[];
  busy: boolean;
  onFollowUp: (q: string) => void;
  /** The question box, docked under the thread. */
  composer?: ReactNode;
  /** Ask the latest answer's question again. */
  onRegenerate?: (q: string) => void;
}

function ScrollToEnd() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  if (isAtBottom) return null;
  return (
    <button type="button" onClick={() => void scrollToBottom()} aria-label="Scroll to end" className="cg-toend animate-option-pill-in">
      <ArrowDown />
    </button>
  );
}

function clock(at?: number): string | null {
  if (!at) return null;
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** YYYY-MM-DD the records were read, from the answer's own stamp. */
export function retrievedDate(answer: TapAnswer): string {
  const stamp = `${answer.verifiedAt ?? ''} ${answer.profile?.provenance.captureTime ?? ''}`;
  const m = stamp.match(/\d{4}-\d{2}-\d{2}/);
  if (m) return m[0];
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The register strip over an answer: what record, from where, read when. */
function stripFor(answer: TapAnswer): { record: string; source: string } {
  if (answer.scope === 'redirect') return { record: 'Reference', source: 'Taproot notes' };
  if (answer.pwsid === 'UNKNOWN') return { record: 'No match', source: 'EPA SDWIS' };
  if (answer.profile) return { record: answer.pwsid, source: 'EPA SDWIS' };
  if (answer.metrics.length) return { record: answer.pwsid, source: 'Utility report' };
  return { record: answer.pwsid, source: 'EPA ECHO' };
}

const fmt = new Intl.NumberFormat('en-US');

/** Four facts from the record, filed as register cells. */
function factsFor(answer: TapAnswer): RecordChip[] {
  const p = answer.profile;
  if (!p || answer.pwsid === 'UNKNOWN' || answer.scope === 'redirect') return [];
  const out: RecordChip[] = [];
  if (p.primarySource) out.push({ name: 'Source', detail: p.primarySource.charAt(0).toUpperCase() + p.primarySource.slice(1).toLowerCase() });
  if (p.population) out.push({ name: 'Served', detail: `${fmt.format(p.population)} people` });
  out.push({ name: 'PWSID', detail: p.pwsid, mono: true, href: answer.echoUrl || undefined });
  const surveyYear = p.lastSanitarySurvey?.date?.slice(0, 4);
  if (surveyYear) out.push({ name: 'Inspection', detail: `Last inspected ${surveyYear}` });
  else if (p.state) out.push({ name: 'State', detail: p.state, mono: true });
  return out;
}

function AssistantTurn({
  msg,
  isLatest,
  busy,
  onFollowUp,
  onRegenerate,
}: {
  msg: ChatMsg;
  isLatest: boolean;
  busy: boolean;
  onFollowUp: (q: string) => void;
  onRegenerate?: (q: string) => void;
}) {
  const answer = msg.answer as TapAnswer;
  const [revealed, setRevealed] = useState(!msg.fresh);
  const [srcOpen, setSrcOpen] = useState(false);
  const [hl, setHl] = useState<number | null>(null);
  const hlTimer = useRef<number>();
  const onDone = useCallback(() => setRevealed(true), []);
  const chips = isLatest && answer.followUps.length > 0 ? answer.followUps : [];
  const steps = traceFor(answer);
  const state = answer.profile?.state;
  const shownPlace = state && !answer.placeName.includes(',') ? `${answer.placeName}, ${state}` : answer.placeName;
  // No system picked yet: the alternatives are the only choices, nothing is "shown now".
  const ambiguous = answer.pwsid === 'UNKNOWN';
  const markdown = answer.markdown.replace(/\bug\/L\b/g, 'µg/L');
  const sources: SourceLink[] = answer.scope === 'redirect' ? [] : sourcesFor(answer);
  const strip = stripFor(answer);
  const retrieved = retrievedDate(answer);
  const facts = factsFor(answer);
  const idBase = `src-${msg.id}`;

  // Cite tags: one per distinct dataset, the first three.
  const cited: Array<{ s: SourceLink; i: number }> = [];
  sources.forEach((s, i) => {
    if (cited.length < 3 && !cited.some((c) => tagOf(c.s) === tagOf(s))) cited.push({ s, i });
  });

  function goToSource(i: number) {
    setSrcOpen(true);
    setHl(i);
    window.clearTimeout(hlTimer.current);
    hlTimer.current = window.setTimeout(() => setHl(null), 2400);
    window.setTimeout(() => document.getElementById(`${idBase}-${i + 1}`)?.focus({ preventScroll: false }), 320);
  }

  const tail =
    cited.length > 0 ? (
      <>
        {' '}
        {cited.map(({ s, i }) => (
          <CitePill key={s.href} source={{ ...s, tag: tagOf(s) }} onClick={() => goToSource(i)} />
        ))}
      </>
    ) : null;

  return (
    <article className="cg-asst animate-message-in" aria-label="Answer">
      <AssistantMark />
      <div className="cg-asst-body rc-turn">
      {steps.length > 0 && <ThinkingTrace steps={steps} working={false} elapsedMs={msg.elapsedMs} />}
      <div className="rc-entry">
        <div className="rc-entry-strip">
          <span>
            Record <b>{strip.record}</b>
          </span>
          <span>
            Source <b>{strip.source}</b>
          </span>
          <span className="r">
            Retrieved <b>{retrieved}</b>
          </span>
        </div>
        <StreamingAnswer markdown={markdown} animate={Boolean(msg.fresh)} onDone={onDone} tail={revealed ? tail : null} />
      </div>
      {revealed && (
        <>
          {answer.alternatives.length > 0 && isLatest && (
            <ClarifyCard
              question={ambiguous ? 'Which one did you mean?' : `Showing ${shownPlace}. Did you mean another one?`}
              options={
                ambiguous
                  ? answer.alternatives.map((alt) => ({ label: alt }))
                  : [{ label: shownPlace, hint: 'Shown now' }, ...answer.alternatives.map((alt) => ({ label: alt }))]
              }
              initial={ambiguous ? null : 0}
              skipLabel={ambiguous ? 'Not now' : undefined}
              disabled={busy}
              onChoose={(o) => {
                if (o.label !== shownPlace) onFollowUp(`Tell me about ${o.label} water`);
              }}
              onSkip={() => undefined}
            />
          )}
          {facts.length > 0 && <RecordChips chips={facts} label="From the record" className="kit-fade-in" />}
          <EvidenceCard answer={answer} initiallyOpen={isLatest && answer.focus !== 'general'} onAsk={busy ? undefined : onFollowUp} />
          <AnswerActions
            answer={answer}
            copyText={markdown}
            sources={sources}
            open={srcOpen}
            onToggleSources={() => setSrcOpen(!srcOpen)}
            onRegenerate={isLatest && onRegenerate && answer.question ? () => onRegenerate(answer.question as string) : undefined}
            retrieved={retrieved}
            idPrefix={idBase}
            highlight={hl}
          />
          {chips.length > 0 && <FollowUpList items={chips} onPick={onFollowUp} disabled={busy} />}
        </>
      )}
      </div>
    </article>
  );
}

export function ChatPane({ messages, busy, onFollowUp, composer, onRegenerate }: ChatPaneProps) {
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;
  return (
    <div className="cg-pane">
      <StickToBottom className="relative min-h-0 flex-1 overflow-y-hidden" initial="smooth" resize="smooth" role="log">
        <StickToBottom.Content className="scrollbar-thin">
          <div className="cg-thread">
            <h2 className="sr-only">Conversation with Taproot</h2>
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="cg-user animate-message-in">
                  <div className="cg-bubble" title={clock(m.at) ?? undefined}>
                    <span className="sr-only">You said{clock(m.at) ? ` at ${clock(m.at)}` : ''}: </span>
                    <span>{m.text}</span>
                  </div>
                </div>
              ) : m.stopped || !m.answer ? (
                <div key={m.id} className="cg-asst animate-message-in">
                  <AssistantMark />
                  <p className="cg-asst-body cg-stopped" role="status">
                    Stopped. Ask again whenever you're ready.
                  </p>
                </div>
              ) : (
                <AssistantTurn
                  key={m.id}
                  msg={m}
                  isLatest={m.id === lastAssistantId && !busy}
                  busy={busy}
                  onFollowUp={onFollowUp}
                  onRegenerate={onRegenerate}
                />
              ),
            )}
            {busy && <LiveTrace />}
          </div>
        </StickToBottom.Content>
        <ScrollToEnd />
      </StickToBottom>
      {composer != null && <div className="cg-dock">{composer}</div>}
    </div>
  );
}
