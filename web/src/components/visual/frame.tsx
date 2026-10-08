import { animate, useInView, useReducedMotion } from 'motion/react';
import { ArrowUpRightIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The one figure under an answer. Editorial, not dashboard: a quiet eyebrow,
 * one big serif number or phrase, the drawing, and a single source line.
 */
export function VisualFrame({
  eyebrow,
  headline,
  sub,
  children,
  source,
  sourceUrl,
  className,
  bleed = false,
}: {
  eyebrow: string;
  headline?: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  source: string;
  sourceUrl?: string;
  className?: string;
  /** Let the drawing run edge to edge (maps). */
  bleed?: boolean;
}) {
  return (
    <figure className={cn('viz animate-rich-content-in mt-5 overflow-hidden rounded-[28px] border bg-card', className)}>
      <header className="px-5 pt-5 sm:px-6">
        <p className="text-[13px] font-medium tracking-[0.01em] text-muted-foreground">{eyebrow}</p>
        {headline && <h3 className="mt-1 font-display text-[30px] font-medium leading-[1.1] tracking-[-0.01em] sm:text-[34px]">{headline}</h3>}
        {sub && <p className="mt-1.5 max-w-[52ch] text-[15px] leading-snug text-muted-foreground">{sub}</p>}
      </header>
      <div className={cn(bleed ? 'mt-4' : 'px-5 pb-1 pt-4 sm:px-6')}>{children}</div>
      <figcaption className="flex items-center justify-between gap-3 px-5 pb-4 pt-3 text-[12.5px] text-muted-foreground sm:px-6">
        <span className="min-w-0 truncate">{source}</span>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="press inline-flex shrink-0 items-center gap-0.5 font-medium text-[var(--link)] hover:underline"
          >
            EPA record
            <ArrowUpRightIcon className="size-3.5" />
          </a>
        )}
      </figcaption>
    </figure>
  );
}

/** Counts up to `value` the first time it scrolls into view. */
export function CountUp({ value, decimals, className }: { value: number; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const reduce = useReducedMotion();
  const d = decimals ?? (Math.abs(value) >= 100 || Number.isInteger(value) ? 0 : Math.abs(value) >= 10 ? 1 : 2);
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d });
  const [shown, setShown] = useState(reduce ? fmt(value) : fmt(0));
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setShown(fmt(value));
      return;
    }
    const c = animate(0, value, { duration: 1.1, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setShown(fmt(v)) });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, reduce]);
  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {shown}
    </span>
  );
}

/** True once the element is on screen; drawings start then, not on mount. */
export function useOnScreen<T extends Element>() {
  const ref = useRef<T>(null);
  const seen = useInView(ref, { once: true, margin: '-8% 0px' });
  return [ref, seen] as const;
}

export const TONE = {
  alert: 'var(--level-alert)',
  watch: 'var(--level-watch)',
  ok: 'var(--level-ok)',
  water: 'var(--link)',
  ink: 'var(--foreground)',
  faint: 'var(--tertiary)',
} as const;
