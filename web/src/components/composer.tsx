import { useEffect, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RcArrow, RcAttach, RcLocate, RcMic, RcStop } from './chat/rc-icons';
import '../styles/record-chat.css';

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
  /** Footnote under the field (privacy links etc.). */
  foot?: React.ReactNode;
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
        <button type="button" aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick} className="rc-btn icon">
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Public Record composer: a labelled government form field. "Question"
 * over a 2px ink box, quiet square tools, a register-blue Send that
 * becomes an ink-bordered Stop while records are read.
 */
export function Composer(props: ComposerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const canSend = props.input.trim().length > 0 && !props.busy;

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = '0px';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
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
      className="rc-composer"
    >
      <div className="rc-cmp-label">
        <label htmlFor="composer-input">
          Question<span className="sr-only"> — {props.label}</span>
        </label>
        <span aria-hidden="true">US city, ZIP, or system ID</span>
      </div>
      <div className="rc-cmp-box">
        {props.busy && <div className="rc-cmp-prog" aria-hidden="true" />}
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
          placeholder={props.placeholder ?? 'Ask about your water…'}
          className="rc-cmp-text"
        />
        <div className="rc-cmp-bar">
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
            <RcAttach />
          </Tool>
          <Tool label={props.listening ? 'Listening…' : 'Ask by voice'} onClick={props.onVoice} active={props.listening}>
            <RcMic className={props.listening ? 'dot-pulse' : undefined} />
          </Tool>
          <Tool
            label={props.coordsActive ? 'Location on, tap to turn off' : 'Use my location'}
            onClick={props.onLocate}
            active={props.coordsActive}
            disabled={props.locating}
          >
            <RcLocate className={props.locating ? 'dot-pulse' : undefined} />
          </Tool>
          <span className="spacer" />
          <span className="hint" aria-hidden="true">
            {props.busy ? 'Reading records…' : '↵ to send'}
          </span>
          {props.busy ? (
            <button type="button" onClick={props.onStop} aria-label="Stop response" className="rc-btn stop">
              <RcStop />
              Stop
            </button>
          ) : (
            <button type="submit" disabled={!canSend} aria-label="Send message" className="rc-btn primary">
              Send
              <RcArrow />
            </button>
          )}
        </div>
      </div>
      {props.foot !== undefined ? (
        <div className="rc-cmp-foot">{props.foot}</div>
      ) : (
        <p className="rc-cmp-foot">Answers come from EPA records (SDWIS, Lead &amp; Copper Rule, UCMR 5), not a test of your tap.</p>
      )}
    </form>
  );
}
