import { useState } from 'react';
import { cn } from '@/lib/utils';
import { RcChevDown, RcChevRight } from '../chat/rc-icons';
import { RecordLoader } from './drop-loader';
import { formatElapsed, useElapsed } from './motion';
import '../../styles/record-chat.css';

/* ─────────────────────────────────────────────────────────
 * THINKING TRACE — what Taproot did to answer (Public Record)
 *
 * While working: a ticking rule, one tick per record step,
 * with the current step named in mono.
 * When done: one ruled line, "Checked 8 records · 2.4s",
 * that opens to numbered steps with what each one read.
 * ───────────────────────────────────────────────────────── */

export interface TraceStep {
  /** What happened, in plain words ("Found the water system"). */
  label: string;
  /** Short detail on the right (a PWSID, "2026 Q2", "11 periods"). */
  detail?: string;
  /** Record behind the step; the label becomes a link. */
  href?: string;
  /** Mark a step that turned up something above a limit. */
  tone?: 'default' | 'alert';
}

export interface ThinkingTraceProps {
  steps: TraceStep[];
  /** True while the answer is still being worked out. */
  working: boolean;
  /** Live label while working (defaults to the current step). */
  activeLabel?: string;
  /** Settled header ("Checked 4 records"). Elapsed time is appended. */
  doneLabel?: string;
  /** Time the work took, for the settled header. Live when working. */
  elapsedMs?: number;
  /** Total steps expected while working (for the rule's progress). */
  totalSteps?: number;
  /** Expanded state; uncontrolled defaults to closed. */
  defaultOpen?: boolean;
  className?: string;
}

export function ThinkingTrace({ steps, working, activeLabel, doneLabel, elapsedMs, totalSteps, defaultOpen, className }: ThinkingTraceProps) {
  const live = useElapsed(working);
  const [open, setOpen] = useState<boolean>(defaultOpen ?? false);

  if (working) {
    const total = Math.max(totalSteps ?? steps.length, steps.length, 1);
    const current = steps[steps.length - 1];
    return (
      <div className={cn('rc-trace', className)} role="status" aria-live="polite">
        <RecordLoader
          label={`${activeLabel ?? current?.label ?? 'Reading the records'}…`}
          progress={steps.length / total}
          right={`${steps.length} / ${total} · ${formatElapsed(live)}`}
        />
      </div>
    );
  }

  const head = doneLabel ?? `Checked ${steps.length} ${steps.length === 1 ? 'record' : 'records'}`;
  return (
    <div className={cn('rc-trace', className)}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="rc-trace-sum">
        {open ? <RcChevDown /> : <RcChevRight />}
        <span className="what">
          {head}
          {elapsedMs !== undefined && <span className="tabular-nums"> · {formatElapsed(elapsedMs)}</span>}
        </span>
        <span className="tick" aria-hidden="true" />
        <span className="show" aria-hidden="true">
          {open ? 'Hide' : 'Show'}
        </span>
      </button>
      <div className="rc-fold" style={{ gridTemplateRows: open ? '1fr' : '0fr', opacity: open ? 1 : 0 }}>
        <div {...(open ? {} : { inert: '' as unknown as boolean, 'aria-hidden': true })}>
          <ol className="rc-trace-steps" aria-label="Steps">
            {steps.map((s, i) => (
              <li key={`${i}-${s.label}`} className={cn(s.tone === 'alert' && 'alert')}>
                <span className="n">{String(i + 1).padStart(2, '0')}</span>
                {s.href ? (
                  <a className="s" href={s.href} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                ) : (
                  <span className="s">{s.label}</span>
                )}
                {s.detail ? <span className="t">{s.detail}</span> : <span />}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
