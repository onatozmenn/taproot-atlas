import { ArrowDownIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';
import type { TapAnswer } from '../api';
import { AnswerActions } from './chat/answer-actions';
import { EvidenceCard } from './chat/evidence-card';
import { StreamingAnswer } from './chat/streaming-answer';
import { ThinkingRow } from './chat/thinking-row';

export interface ChatMsg {
  id: number;
  role: 'user' | 'assistant';
  text?: string;
  answer?: TapAnswer;
  /** True for the answer that just arrived: it streams in and animates. */
  fresh?: boolean;
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
  const markdown = answer.markdown.replace(/\bug\/L\b/g, 'µg/L');

  return (
    <article className="animate-message-in" aria-label="Answer">
      <StreamingAnswer markdown={markdown} animate={Boolean(msg.fresh)} onDone={onDone} />
      {revealed && (
        <>
          {answer.alternatives.length > 0 && (
            <p className="animate-message-action-in mt-3 text-sm text-muted-foreground">
              Showing the largest system for {answer.placeName}. Did you mean{' '}
              {answer.alternatives.map((alt, i) => (
                <span key={alt}>
                  {i > 0 && (i === answer.alternatives.length - 1 ? ' or ' : ', ')}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onFollowUp(`Tell me about ${alt} water`)}
                    className="press font-medium text-[var(--link)] underline-offset-2 hover:underline"
                  >
                    {alt}
                  </button>
                </span>
              ))}
              ?
            </p>
          )}
          <AnswerActions answer={answer} copyText={markdown} />
          <EvidenceCard answer={answer} initiallyOpen={isLatest && answer.focus !== 'general'} />
          {chips.length > 0 && (
            <div className="mt-5 flex flex-col items-start gap-2.5" aria-label="Suggested follow-ups">
              {chips.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  disabled={busy}
                  onClick={() => onFollowUp(c)}
                  style={{ animationDelay: `${120 + i * 70}ms` }}
                  className="press animate-option-pill-in flex min-h-14 w-fit max-w-full items-center rounded-[40px] border border-border bg-transparent px-6 py-3 text-left text-[16px] hover:border-foreground/40 hover:bg-secondary disabled:opacity-50"
                >
                  {c}
                </button>
              ))}
            </div>
          )}
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
            ) : (
              <AssistantTurn key={m.id} msg={m} isLatest={m.id === lastAssistantId && !busy} busy={busy} onFollowUp={onFollowUp} />
            ),
          )}
          {busy && <ThinkingRow />}
        </div>
      </StickToBottom.Content>
      <ScrollToEnd />
    </StickToBottom>
  );
}
