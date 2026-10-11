import { useEffect, useRef } from 'react';
import { ArrowUp, LocateFixed, Mic, Paperclip, Square } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import '../styles/chatgpt-shell.css';

interface ComposerProps {
  input: string;
  onInputChange: (v: string) => void;
  onSend: (text: string) => void;
  busy: boolean;
  onStop: () => void;
  onAttachFile: (file: File) => void;
  onVoice: () => void;
  listening: boolean;
  onLocate: () => void;
  locating: boolean;
  coordsActive: boolean;
  placeholder?: string;
  /** Accessible name for the field. */
  label: string;
  autoFocus?: boolean;
  /** Line under the box (disclaimer, privacy links). `null` hides it. */
  foot?: React.ReactNode;
  className?: string;
}

function Tool({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick} className="cg-tool">
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Chat composer: a soft rounded box with an auto-growing field, quiet tools
 * on the left and a round send button that turns into Stop while an answer
 * is on its way. Enter sends, Shift+Enter adds a new line.
 */
export function Composer(props: ComposerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const canSend = props.input.trim().length > 0 && !props.busy;

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = '0px';
    ta.style.height = `${Math.min(ta.scrollHeight, 208)}px`;
  }, [props.input]);

  useEffect(() => {
    // Touch screens: focusing on load throws up the keyboard and hides the
    // starter questions, so only auto-focus where there is a fine pointer.
    const fine = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: fine)').matches : true;
    if (props.autoFocus && fine) taRef.current?.focus();
  }, [props.autoFocus]);

  function submit() {
    const text = props.input.trim().slice(0, 2000);
    if (text && !props.busy) props.onSend(text);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cn('cg-composer', props.className)}
    >
      <div className="cg-cmp-box" onClick={(e) => e.target === e.currentTarget && taRef.current?.focus()}>
        <label htmlFor="composer-input" className="sr-only">
          {props.label}
        </label>
        <textarea
          id="composer-input"
          ref={taRef}
          rows={1}
          value={props.input}
          onChange={(e) => props.onInputChange(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={props.placeholder ?? 'Ask about any US city, ZIP or water system'}
          className="cg-cmp-text"
        />
        <div className="cg-cmp-bar">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.csv,.json"
            hidden
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) props.onAttachFile(f);
              e.target.value = '';
            }}
          />
          <Tool label="Attach a text file" onClick={() => fileRef.current?.click()}>
            <Paperclip />
          </Tool>
          <Tool
            label={props.coordsActive ? 'Location on, tap to turn off' : 'Use my location'}
            onClick={props.onLocate}
            active={props.coordsActive}
            disabled={props.locating}
          >
            <LocateFixed className={props.locating ? 'dot-pulse' : undefined} />
          </Tool>
          <span className="cg-spacer" />
          <Tool label={props.listening ? 'Listening…' : 'Ask by voice'} onClick={props.onVoice} active={props.listening}>
            <Mic className={props.listening ? 'dot-pulse' : undefined} />
          </Tool>
          {props.busy ? (
            <button type="button" onClick={props.onStop} aria-label="Stop response" className="cg-send stop">
              <Square fill="currentColor" strokeWidth={0} />
            </button>
          ) : (
            <button type="submit" disabled={!canSend} aria-label="Send message" className="cg-send">
              <ArrowUp strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>
      {props.foot !== null && (
        <div className="cg-cmp-foot">
          {props.foot ?? 'Taproot reads public EPA records and can be wrong. It is not a test of your tap.'}
        </div>
      )}
    </form>
  );
}
