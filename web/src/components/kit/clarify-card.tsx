import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────
 * CLARIFY CARD — when a question could mean more than one
 * place, ask once with numbered choices. 1–9 picks, Enter
 * continues, Esc skips. The answer already shown stays put.
 * ───────────────────────────────────────────────────────── */

export interface ClarifyOption {
  label: string;
  hint?: string;
}

export interface ClarifyCardProps {
  question: string;
  options: ClarifyOption[];
  onChoose: (option: ClarifyOption) => void;
  onSkip?: () => void;
  skipLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function ClarifyCard({ question, options, onChoose, onSkip, skipLabel = 'Keep this one', disabled, className }: ClarifyCardProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  function confirm(i: number | null) {
    if (i === null || disabled) return;
    setDone(true);
    onChoose(options[i]);
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) {
        e.preventDefault();
        setPicked(n - 1);
      } else if (e.key === 'Enter' && picked !== null) {
        e.preventDefault();
        confirm(picked);
      } else if (e.key === 'Escape' && onSkip) {
        setDone(true);
        onSkip();
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  });

  if (done) return null;
  return (
    <div
      ref={ref}
      role="group"
      aria-labelledby={titleId}
      className={cn('kit-fade-up w-full rounded-3xl border border-border bg-card p-2 shadow-[var(--shadow-elevation-1)]', className)}
    >
      <p id={titleId} className="px-3 pb-2 pt-2.5 text-[16px] font-semibold">
        {question}
      </p>
      <div role="radiogroup" className="flex flex-col gap-1">
        {options.map((o, i) => {
          const on = picked === i;
          return (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => setPicked(i)}
              onDoubleClick={() => confirm(i)}
              className={cn(
                'press flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-secondary',
                on && 'bg-secondary ring-1 ring-[var(--link)]',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-lg border border-border font-mono text-[12px] tabular-nums text-muted-foreground transition-colors',
                  on && 'border-[var(--link)] bg-[var(--link)] text-white',
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] font-medium">{o.label}</span>
                {o.hint && <span className="block text-[13px] text-muted-foreground">{o.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 px-1 pb-1">
        {onSkip && (
          <button
            type="button"
            onClick={() => {
              setDone(true);
              onSkip();
            }}
            className="press h-9 rounded-full px-4 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {skipLabel}
          </button>
        )}
        <button
          type="button"
          disabled={picked === null || disabled}
          onClick={() => confirm(picked)}
          className="press h-9 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
