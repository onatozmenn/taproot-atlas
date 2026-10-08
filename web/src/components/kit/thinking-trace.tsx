import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DropGrid } from './drop-loader';
import { formatElapsed, useElapsed } from './motion';

/* ─────────────────────────────────────────────────────────
 * THINKING TRACE — what Taproot did to answer, step by step
 *
 * While working: a droplet grid, a shimmering live label and
 * the steps reached so far (spinner on the current one).
 * When done: settles to one quiet line ("Checked 4 records in
 * 3.2s") that expands to the steps, each with what it read and
 * a link to the record. A rail grows beside the steps.
 * ───────────────────────────────────────────────────────── */

export interface TraceStep {
  /** What happened, in plain words ("Found the water system"). */
  label: string;
  /** Short detail on the right (a PWSID, "2026 Q2", "11 periods"). */
  detail?: string;
  /** Record behind the step; the row becomes a link. */
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
  /** Expanded state; uncontrolled defaults to open while working. */
  defaultOpen?: boolean;
  className?: string;
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tertiary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Spinner() {
  return <span aria-hidden="true" className="kit-spin size-3 shrink-0 rounded-full border-[1.5px] border-border border-t-[var(--link)]" />;
}

function Drop({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path d="M12 2.5c3.6 4.4 6.5 8 6.5 11.6A6.5 6.5 0 0 1 5.5 14.1C5.5 10.5 8.4 6.9 12 2.5Z" fill={filled ? 'var(--link)' : 'none'} stroke="var(--link)" strokeWidth="1.8" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tertiary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-300" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ThinkingTrace({ steps, working, activeLabel, doneLabel, elapsedMs, defaultOpen, className }: ThinkingTraceProps) {
  const live = useElapsed(working);
  const [manual, setManual] = useState<boolean | null>(defaultOpen ?? null);
  const open = manual ?? working;
  const railRef = useRef<HTMLOListElement>(null);
  const [rail, setRail] = useState(0);
  useLayoutEffect(() => {
    if (railRef.current) setRail(railRef.current.offsetHeight);
  }, [steps.length, open, working]);

  const current = steps[steps.length - 1];
  const header: ReactNode = working ? (
    <span key={activeLabel ?? current?.label} className="text-shimmer animate-message-action-in whitespace-nowrap">
      {activeLabel ?? current?.label ?? 'Working'}
    </span>
  ) : (
    <span className="kit-fade-in whitespace-nowrap text-muted-foreground">
      {doneLabel ?? `Checked ${steps.length} ${steps.length === 1 ? 'record' : 'records'}`}
    </span>
  );
  const time = working ? live : elapsedMs;

  return (
    <div className={cn('flex w-full flex-col', className)} role={working ? 'status' : undefined} aria-live={working ? 'polite' : undefined}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setManual(!open)}
        className="press -mx-2 flex w-fit items-center gap-2 rounded-full px-2 py-1 text-[15px] font-medium hover:bg-secondary"
      >
        {working ? <DropGrid variant="rain" /> : <Drop filled />}
        {header}
        {time !== undefined && <span className="font-mono text-[12.5px] font-normal tabular-nums text-[var(--tertiary)]">{formatElapsed(time)}</span>}
        <Chevron open={open} />
      </button>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-500"
        style={{ gridTemplateRows: open ? '1fr' : '0fr', opacity: open ? 1 : 0, transitionTimingFunction: 'var(--ease-out-quint)' }}
      >
        <div className="overflow-hidden">
          <div className="relative ml-[6px] mt-1 pl-4">
            <span aria-hidden="true" className="absolute left-[3px] top-0 w-px bg-border" style={{ height: rail ? rail - 6 : 0, transition: 'height 500ms var(--ease-out-quint)' }} />
            <ol ref={railRef} className="flex flex-col gap-0.5 py-1" aria-label="Steps">
              {steps.map((s, i) => {
                const isCurrent = working && i === steps.length - 1;
                const body = (
                  <>
                    {isCurrent ? <Spinner /> : <Check />}
                    <span className={cn('min-w-0 truncate text-[14px]', s.tone === 'alert' ? 'text-[var(--level-alert)]' : 'text-foreground')}>{s.label}</span>
                    {s.detail && <span className="ml-auto shrink-0 pl-3 font-mono text-[12px] tabular-nums text-[var(--tertiary)]">{s.detail}</span>}
                  </>
                );
                const cls = 'flex min-h-8 w-full items-center gap-2 rounded-lg px-2 py-1 text-left';
                const style = { animation: `kit-fade-up 320ms var(--ease-out-quint) ${working ? 0 : i * 60}ms both` };
                return (
                  <li key={`${i}-${s.label}`} style={style}>
                    {s.href ? (
                      <a href={s.href} target="_blank" rel="noreferrer" className={cn(cls, 'press hover:bg-secondary')}>
                        {body}
                      </a>
                    ) : (
                      <div className={cls}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
