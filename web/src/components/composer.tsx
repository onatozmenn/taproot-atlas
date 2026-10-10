import { ArrowUpIcon, LocateFixedIcon, MicIcon, PaperclipIcon, SquareIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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
  label: string;
  autoFocus?: boolean;
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
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            'press inline-flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40',
            active && 'bg-secondary text-[var(--link)]',
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * America.gov-style composer: one rounded white surface with a soft
 * elevation shadow, auto-growing textarea, quiet tools on the left and a
 * round navy send button that turns into Stop while an answer is coming.
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
      className="group rounded-[28px] border border-border bg-card shadow-[var(--shadow-elevation-1)] transition-[border-color,box-shadow] duration-200 focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-[var(--link)]/35"
    >
      <label className="sr-only" htmlFor="composer-input">
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
        placeholder={props.placeholder ?? 'Ask anything…'}
        className="block max-h-[200px] min-h-[52px] w-full resize-none bg-transparent px-5 pb-1 pt-4 text-[17px] leading-normal outline-none placeholder:text-[var(--tertiary)]"
      />
      <div className="flex items-center gap-0.5 px-2 pb-2">
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
          <PaperclipIcon className="size-[18px]" />
        </Tool>
        <Tool label={props.listening ? 'Listening…' : 'Ask by voice'} onClick={props.onVoice} active={props.listening}>
          <MicIcon className="size-[18px]" />
        </Tool>
        <Tool
          label={props.coordsActive ? 'Location on, tap to turn off' : 'Use my location'}
          onClick={props.onLocate}
          active={props.coordsActive}
          disabled={props.locating}
        >
          <LocateFixedIcon className={cn('size-[18px]', props.locating && 'dot-pulse')} />
        </Tool>
        <div className="ml-auto">
          {props.busy ? (
            <button
              type="button"
              onClick={props.onStop}
              aria-label="Stop response"
              className="press inline-flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90"
            >
              <SquareIcon className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send message"
              className="press inline-flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:bg-[var(--border)] disabled:text-[var(--tertiary)]"
            >
              <ArrowUpIcon className="size-5" />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
