import { CheckIcon, CopyIcon, Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageActions, MessageAction, MessageContent } from '@/components/ai-elements/message';
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion';
import { Source, Sources, SourcesContent, SourcesTrigger } from '@/components/ai-elements/sources';
import { Skeleton } from '@/components/ui/skeleton';
import type { TapAnswer } from '../api';
import { renderMarkdown } from '../md';
import { Composer } from './composer';

export interface ChatMsg {
  id: number;
  role: 'user' | 'assistant';
  text?: string;
  answer?: TapAnswer;
}

interface ChatPaneProps {
  messages: ChatMsg[];
  busy: boolean;
  input: string;
  onInputChange: (v: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  chipsFor: (answer: TapAnswer) => string[];
  onChip: (chip: string, answer: TapAnswer) => void;
  onAttachFile: (file: File) => void;
  onVoice: () => void;
  listening: boolean;
  onLocate: () => void;
  locating: boolean;
  coordsActive: boolean;
  label: string;
}

function provenanceLinks(answer: TapAnswer): Array<{ href: string; title: string }> {
  const links = [{ href: answer.echoUrl, title: `EPA ECHO profile (${answer.pwsid})` }];
  const filing = answer.metrics[0]?.provenance.sourceDocumentUrl;
  if (filing) links.push({ href: filing, title: `Regulatory filing (${answer.metrics[0].provenance.reportPeriod})` });
  return links;
}

export function ChatPane(props: ChatPaneProps) {
  const { messages, busy } = props;
  const [copied, setCopied] = useState<number | null>(null);

  async function copyAnswer(id: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {messages.map((m) =>
            m.role === 'user' ? (
              <Message key={m.id} from="user">
                <MessageContent>{m.text}</MessageContent>
              </Message>
            ) : (
              <Message key={m.id} from="assistant">
                <MessageContent>
                  {m.answer && m.answer.scope === 'redirect' ? (
                    <div>{renderMarkdown([m.answer.overview, m.answer.details].filter(Boolean).join('\n\n'))}</div>
                  ) : (
                    <div>{renderMarkdown(m.answer?.overview ?? '')}</div>
                  )}
                </MessageContent>
                {m.answer && m.answer.scope !== 'redirect' && (
                  <Sources>
                    <SourcesTrigger count={provenanceLinks(m.answer).length} />
                    <SourcesContent>
                      {provenanceLinks(m.answer).map((l) => (
                        <Source key={l.href} href={l.href} title={l.title} />
                      ))}
                    </SourcesContent>
                  </Sources>
                )}
                <MessageActions>
                  <MessageAction
                    tooltip={copied === m.id ? 'Copied' : 'Copy answer'}
                    onClick={() => m.answer && void copyAnswer(m.id, m.answer.overview)}
                    aria-label="Copy answer"
                  >
                    {copied === m.id ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
                  </MessageAction>
                </MessageActions>
                {m.answer && m.answer.scope !== 'redirect' && props.chipsFor(m.answer).length > 0 && (
                  <Suggestions aria-label="Suggested follow-ups">
                    {props.chipsFor(m.answer).map((chip) => (
                      <Suggestion
                        key={chip}
                        suggestion={chip}
                        disabled={busy}
                        onClick={() => props.onChip(chip, m.answer as TapAnswer)}
                      />
                    ))}
                  </Suggestions>
                )}
              </Message>
            ),
          )}
          {busy && (
            <Message from="assistant">
              <MessageContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                  <Loader2Icon className="size-4 animate-spin" />
                  <span>Working through your request…</span>
                </div>
                <div className="mt-2 space-y-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="sticky bottom-0 border-t bg-background p-3">
        <Composer
          input={props.input}
          onInputChange={props.onInputChange}
          onSend={props.onSend}
          busy={busy}
          onStop={props.onStop}
          onAttachFile={props.onAttachFile}
          onVoice={props.onVoice}
          listening={props.listening}
          onLocate={props.onLocate}
          locating={props.locating}
          coordsActive={props.coordsActive}
          label={props.label}
        />
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Demonstration snapshot · EPA / NYC open data · Reports only. Never a safety verdict. Verify at the
          official source.
        </p>
      </div>
    </div>
  );
}
