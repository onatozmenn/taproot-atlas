import { ArrowDownIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';
import type { TapAnswer } from '../api';
import { AnswerActions } from './chat/answer-actions';
import { EvidenceCard } from './chat/evidence-card';
import { StreamingAnswer } from './chat/streaming-answer';
import { LIVE_DELAYS, LIVE_STEPS, traceFor } from './chat/answer-trace';
import { ClarifyCard, FollowUpList, ThinkingTrace, useStages } from './kit';

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
}

/** The trace while an answer is on its way: steps reached so far, live timer. */
function LiveTrace() {
  const stage = useStages(LIVE_DELAYS);
  const steps = LIVE_STEPS.slice(0, stage + 1).map((label) => ({ label }));
  return <ThinkingTrace steps={steps} working className="animate-message-in" />;
}

interface ChatPaneProps {
  messages: ChatMsg[];
  busy: boolean;
  onFollowUp: (q: string) => void;
}

function ScrollToEnd() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  if (isAtBottom) return null;
  return (
    <button
      type="button"
      onClick={() => void scrollToBottom()}
      aria-label="Scroll to end"
      className="press animate-option-pill-in absolute bottom-3 left-1/2 inline-flex size-10 -translate-x-1/2 items-center justify-center rounded-full border bg-card shadow-[var(--shadow-elevation-1)] hover:bg-secondary"
    >
      <ArrowDownIcon className="size-4" />
    </button>
  );
}

function AssistantTurn({
  msg,
  isLatest,
  busy,
  onFollowUp,
}: {
  msg: ChatMsg;
  isLatest: boolean;
  busy: boolean;
  onFollowUp: (q: string) => void;
}) {
  const answer = msg.answer as TapAnswer;
  const [revealed, setRevealed] = useState(!msg.fresh);
  const onDone = useCallback(() => setRevealed(true), []);
  const chips = isLatest && answer.followUps.length > 0 ? answer.followUps : [];
  const steps = traceFor(answer);
  const state = answer.profile?.state;
  const shownPlace = state && !answer.placeName.includes(',') ? `${answer.placeName}, ${state}` : answer.placeName;
  const markdown = answer.markdown.replace(/\bug\/L\b/g, 'µg/L');

  return (
    <article className="animate-message-in" aria-label="Answer">
      {steps.length > 0 && <ThinkingTrace className="mb-3" steps={steps} working={false} elapsedMs={msg.elapsedMs} />}
      <StreamingAnswer markdown={markdown} animate={Boolean(msg.fresh)} onDone={onDone} />
      {revealed && (
        <>
          {answer.alternatives.length > 0 && isLatest && (
            <ClarifyCard
              className="mt-5"
              question={`Showing ${shownPlace}. Did you mean another one?`}
              options={[{ label: shownPlace, hint: 'Shown now' }, ...answer.alternatives.map((alt) => ({ label: alt }))]}
              disabled={busy}
              onChoose={(o) => {
                if (o.label !== shownPlace) onFollowUp(`Tell me about ${o.label} water`);
              }}
              onSkip={() => undefined}
            />
          )}
          <AnswerActions answer={answer} copyText={markdown} />
          <EvidenceCard answer={answer} initiallyOpen={isLatest && answer.focus !== 'general'} onAsk={busy ? undefined : onFollowUp} />
          {chips.length > 0 && <FollowUpList className="mt-6" items={chips} onPick={onFollowUp} disabled={busy} />}
        </>
      )}
    </article>
  );
}

export function ChatPane({ messages, busy, onFollowUp }: ChatPaneProps) {
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;
  return (
    <StickToBottom className="relative min-h-0 flex-1 overflow-y-hidden" initial="smooth" resize="smooth" role="log">
      <StickToBottom.Content className="scrollbar-thin">
        <div className="mx-auto flex w-full max-w-[672px] flex-col gap-8 px-5 pb-10 pt-8">
          <h2 className="sr-only">Conversation with Taproot</h2>
          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="animate-message-in flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-secondary px-5 py-3 text-[17px] leading-normal">
                  {m.text}
                </p>
              </div>
            ) : m.stopped || !m.answer ? (
              <p key={m.id} className="animate-message-in text-[15px] text-muted-foreground" role="status">
                Stopped. Ask again whenever you're ready.
              </p>
            ) : (
              <AssistantTurn key={m.id} msg={m} isLatest={m.id === lastAssistantId && !busy} busy={busy} onFollowUp={onFollowUp} />
            ),
          )}
          {busy && <LiveTrace />}
        </div>
      </StickToBottom.Content>
      <ScrollToEnd />
    </StickToBottom>
  );
}
