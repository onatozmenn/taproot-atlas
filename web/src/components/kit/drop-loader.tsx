import { cn } from '@/lib/utils';
import { formatElapsed, useElapsed, useReducedMotion } from './motion';

/* ─────────────────────────────────────────────────────────
 * DROP LOADER — a 3×3 grid of water droplets for waiting
 *
 *   rain    columns fall one after another, top to bottom
 *   ripple  rings spread from the centre cell outwards
 *   flow    a diagonal current sweeping left to right
 *
 * Paired with a shimmering label and a live elapsed timer in
 * tabular figures. Reduced motion freezes the grid; the timer
 * still ticks so the wait stays honest.
 * ───────────────────────────────────────────────────────── */

export type DropLoaderVariant = 'rain' | 'ripple' | 'flow';

const CELLS = Array.from({ length: 9 }, (_, i) => ({ r: Math.floor(i / 3), c: i % 3 }));

const PATTERNS: Record<DropLoaderVariant, { delay: (r: number, c: number) => number; dur: number }> = {
  rain: { delay: (r, c) => c * 160 + r * 110, dur: 900 },
  ripple: { delay: (r, c) => Math.max(Math.abs(r - 1), Math.abs(c - 1)) * 180, dur: 1000 },
  flow: { delay: (r, c) => (c + Math.abs(r - 1)) * 95, dur: 700 },
};

export function DropGrid({ variant = 'rain', className }: { variant?: DropLoaderVariant; className?: string }) {
  const reduced = useReducedMotion();
  const p = PATTERNS[variant];
  return (
    <span aria-hidden="true" className={cn('grid grid-cols-[repeat(3,5px)] gap-[2px]', className)}>
      {CELLS.map(({ r, c }) => (
        <span
          key={`${r}${c}`}
          className="kit-drop size-[5px] rounded-full rounded-tl-[1px] rotate-45 bg-[var(--link)]"
          style={reduced ? { opacity: 0.35 } : { animation: `kit-drop ${p.dur}ms ease-in-out ${p.delay(r, c)}ms infinite` }}
        />
      ))}
    </span>
  );
}

export interface DropLoaderProps {
  label?: string;
  variant?: DropLoaderVariant;
  /** Show the live elapsed timer (default true). */
  showElapsed?: boolean;
  className?: string;
}

export function DropLoader({ label = 'Reading the records', variant = 'rain', showElapsed = true, className }: DropLoaderProps) {
  const elapsed = useElapsed();
  return (
    <div role="status" aria-live="polite" className={cn('inline-flex w-fit items-center gap-2.5', className)}>
      <DropGrid variant={variant} />
      <span key={label} className="text-shimmer animate-message-action-in text-[15px] font-medium">
        {label}
      </span>
      {showElapsed && <span className="font-mono text-[12.5px] tabular-nums text-[var(--tertiary)]">{formatElapsed(elapsed)}</span>}
    </div>
  );
}
