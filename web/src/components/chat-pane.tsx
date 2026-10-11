import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';
import type { TapAnswer } from '../api';
import { AnswerActions, sourcesFor, type SourceLink } from './chat/answer-actions';
import { EvidenceCard } from './chat/evidence-card';
import { StreamingAnswer } from './chat/streaming-answer';
import { LIVE_DELAYS, LIVE_STEPS, traceFor } from './chat/answer-trace';
import { ArrowDown, Check, Copy, Pencil } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { WaterMark } from './shell/water-mark';
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

/**
 * While an answer is on its way: the droplet fills, the current step glides
 * under a calm water shimmer, and three liquid skeleton lines hold the space
 * the answer will take, so nothing jumps when it lands.
 */
export function ThinkingState() {
  const stage = useStages(LIVE_DELAYS);
  const label = LIVE_STEPS[Math.min(stage, LIVE_STEPS.length - 1)];
  return (
    <div className="cg-asst cg-thinking animate-message-in" role="status" aria-label="Taproot is answering">
      <AssistantMark busy />
      <div className="cg-asst-body">
        <p className="cg-think" aria-hidden="true">
          <span key={stage} className="cg-shimmer">
            {label}
          </span>
        </p>
        <span className="sr-only">Answering. {label}.</span>
        <div className="cg-skel" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}

/** The droplet beside every answer; it fills with water while one is on its way. */
function AssistantMark({ busy }: { busy?: boolean }) {
  return (
    <span className={`cg-avatar${busy ? ' busy' : ''}`} aria-hidden="true">
      <WaterMark size={18} filling={busy} />
    </span>
  );
}

function MiniAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={onClick} aria-label={label} className="cg-act">
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** A question bubble with ChatGPT's hover actions: copy, and edit-and-resend. */
function UserTurn({ msg, busy, onEdit }: { msg: ChatMsg; busy: boolean; onEdit?: (id: number, text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.text ?? '');
  const [copied, setCopied] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }, [editing]);
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = '0px';
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  }, [draft, editing]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(msg.text ?? '');
      setCopied(true);
      toast.success('Message copied');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy. Select the text and copy it instead.');
    }
  }
  const submit = () => {
    const t = draft.trim();
    if (!t || busy || !onEdit) return;
    setEditing(false);
    if (t !== (msg.text ?? '').trim()) onEdit(msg.id, t);
  };
  const cancel = () => {
    setDraft(msg.text ?? '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="cg-user editing">
        <form
          className="cg-edit"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="sr-only" htmlFor={`edit-${msg.id}`}>
            Edit your message
          </label>
          <textarea
            id={`edit-${msg.id}`}
            ref={taRef}
            value={draft}
            rows={1}
            onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              }
            }}
          />
          <div className="cg-edit-bar">
            <button type="button" className="cg-pill" onClick={cancel}>
              Cancel
            </button>
            <button type="submit" className="cg-pill primary" disabled={!draft.trim() || busy}>
              Send
            </button>
          </div>
        </form>
      </div>
    );
  }
  return (
    <div className="cg-user animate-message-in">
      <div className="cg-bubble" title={clock(msg.at) ?? undefined}>
        <span className="sr-only">You said{clock(msg.at) ? ` at ${clock(msg.at)}` : ''}: </span>
        <span>{msg.text}</span>
      </div>
      <div className="cg-user-acts">
        <MiniAction label={copied ? 'Copied' : 'Copy message'} onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}
        </MiniAction>
        {onEdit && !busy && (
          <MiniAction
            label="Edit message"
            onClick={() => {
              setDraft(msg.text ?? '');
              setEditing(true);
            }}
          >
            <Pencil />
          </MiniAction>
        )}
      </div>
    </div>
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
  /** Edit a question and ask it again (drops everything after it). */
  onEdit?: (id: number, text: string) => void;
}

/**
 * When a fresh answer is in and its figure would push the question off the
 * top, park the question at the top of the view (ChatGPT does the same) and
 * stop following, so the answer reads from its first line.
 */
function PinOnAnswer({ tick }: { tick: number }) {
  const { scrollRef, stopScroll } = useStickToBottomContext();
  useEffect(() => {
    if (tick === 0) return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        const sc = scrollRef.current;
        const users = sc?.querySelectorAll<HTMLElement>('.cg-user');
        const last = users?.[users.length - 1];
        if (!sc || !last) return;
        const top = last.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 12;
        if (sc.scrollHeight - top <= sc.clientHeight + 4) return;
        stopScroll();
        const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (typeof sc.scrollTo === 'function') sc.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
        else sc.scrollTop = top;
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [tick, scrollRef, stopScroll]);
  return null;
}

/** A new question always brings the thread to its end, like ChatGPT. */
function FollowOnSend({ count }: { count: number }) {
  const { scrollToBottom } = useStickToBottomContext();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void scrollToBottom('smooth');
  }, [count, scrollToBottom]);
  return null;
}

function ScrollToEnd() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  if (isAtBottom) return null;
  return (
    <button type="button" onClick={() => void scrollToBottom()} aria-label="Scroll to latest message" className="cg-toend animate-option-pill-in">
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
  onRevealed,
}: {
  msg: ChatMsg;
  isLatest: boolean;
  busy: boolean;
  onFollowUp: (q: string) => void;
  onRegenerate?: (q: string) => void;
  /** A fresh answer finished streaming. */
  onRevealed?: () => void;
}) {
  const answer = msg.answer as TapAnswer;
  const [revealed, setRevealed] = useState(!msg.fresh);
  const [srcOpen, setSrcOpen] = useState(false);
  const [hl, setHl] = useState<number | null>(null);
  const hlTimer = useRef<number>();
  const fresh = Boolean(msg.fresh);
  const onDone = useCallback(() => {
    setRevealed(true);
    if (fresh) onRevealed?.();
  }, [fresh, onRevealed]);
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
        {answer.scope !== 'redirect' && (
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
        )}
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

export function ChatPane({ messages, busy, onFollowUp, composer, onRegenerate, onEdit }: ChatPaneProps) {
  const userCount = messages.filter((m) => m.role === 'user').length;
  const [pinTick, setPinTick] = useState(0);
  const onRevealed = useCallback(() => setPinTick((t) => t + 1), []);
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;
  return (
    <div className="cg-pane">
      <StickToBottom className="relative min-h-0 flex-1 overflow-y-hidden" initial="instant" resize="smooth" role="log" aria-label="Conversation">
        <StickToBottom.Content className="scrollbar-thin">
          <div className="cg-thread">
            <h2 className="sr-only">Conversation with Taproot</h2>
            {messages.map((m) =>
              m.role === 'user' ? (
                <UserTurn key={m.id} msg={m} busy={busy} onEdit={onEdit} />
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
                  onRevealed={onRevealed}
                />
              ),
            )}
            {busy && <ThinkingState />}
          </div>
        </StickToBottom.Content>
        <ScrollToEnd />
        <FollowOnSend count={userCount} />
        <PinOnAnswer tick={pinTick} />
      </StickToBottom>
      {composer != null && <div className="cg-dock">{composer}</div>}
    </div>
  );
}
