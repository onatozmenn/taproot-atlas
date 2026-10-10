import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import '../../styles/record-chat.css';

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
  /** Option already in effect (e.g. the place shown now), checked from the start. */
  initial?: number | null;
}

export function ClarifyCard({ question, options, onChoose, onSkip, skipLabel = 'Keep this one', disabled, className, initial = null }: ClarifyCardProps) {
  const [picked, setPicked] = useState<number | null>(initial);
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
    <div ref={ref} role="group" aria-labelledby={titleId} className={cn('rc-clar kit-fade-up w-full', className)}>
      <div className="rc-clar-h">
        <h4 id={titleId}>{question}</h4>
        <span className="rc-lbl">
          {options.length} matching {options.length === 1 ? 'system' : 'systems'}
        </span>
      </div>
      <div role="radiogroup" aria-labelledby={titleId}>
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
              className="rc-opt"
            >
              <span className="rb" aria-hidden="true" />
              <span className="min-w-0">
                <b>{o.label}</b>
                {o.hint && <span className="h">{o.hint}</span>}
              </span>
              <span className="k" aria-hidden="true">
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>
      <div className="rc-clar-f">
        <span className="hint" aria-hidden="true">
          Press 1–{options.length} · ↵ continue
        </span>
        {onSkip && (
          <button
            type="button"
            onClick={() => {
              setDone(true);
              onSkip();
            }}
            className="rc-btn quiet"
          >
            {skipLabel}
          </button>
        )}
        <button type="button" disabled={picked === null || disabled} onClick={() => confirm(picked)} className="rc-btn primary">
          Continue
        </button>
      </div>
    </div>
  );
}
