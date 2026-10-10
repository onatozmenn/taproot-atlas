import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import '../../styles/record-figures.css';

/**
 * The one figure under an answer, drawn as a page of the public record:
 * a 3px ink rule, a mono "FIG. n · label" caption, one big Public Sans
 * hero number with its headline, the drawing, and a source line.
 */
export function VisualFrame({
  fig,
  eyebrow,
  record,
  hero,
  unit,
  headline,
  sub,
  children,
  note,
  source,
  sourceUrl,
  className,
  bleed = false,
}: {
  /** Figure number in the register (1–8). */
  fig?: number;
  /** The caption after "FIG. n ·". */
  eyebrow: string;
  /** Record id (PWSID) shown at the right of the caption strip. */
  record?: string;
  /** The one big number that leads the figure. */
  hero?: ReactNode;
  unit?: ReactNode;
  headline?: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  /** Plain-words caption under the figure (left). Defaults to nothing. */
  note?: ReactNode;
  /** Mono source line (right of the caption). */
  source: string;
  sourceUrl?: string;
  className?: string;
  /** Let the drawing run edge to edge (maps). */
  bleed?: boolean;
}) {
  return (
    <figure className={cn('viz rf', className)} data-fig={fig}>
      <div className="rf-strip">
        <span>
          {fig ? <b>Fig. {fig}</b> : null}
          {fig ? ' · ' : ''}
          {eyebrow}
        </span>
        {record && (
          <span className="rf-strip-r">
            Record <b>{record}</b>
          </span>
        )}
      </div>
      {(hero !== undefined || headline) && (
        <header className="rf-head">
          {hero !== undefined && (
            <span className="rf-num">
              {hero}
              {unit ? <small>{unit}</small> : null}
            </span>
          )}
          {headline && <h3 className="rf-h3">{headline}</h3>}
        </header>
      )}
      {sub && <p className="rf-sub">{sub}</p>}
      <div className={cn('rf-body', bleed && 'rf-bleed')}>{children}</div>
      <figcaption className="rf-cap">
        <span className="rf-cap-note">{note ?? source}</span>
        <span className="rf-cap-r">
          {note ? <span className="rf-cap-src">{source}</span> : null}
          {sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noreferrer" className="rf-cap-link">
              EPA record
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3.5 2.5h6v6M9.5 2.5l-7 7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
              </svg>
            </a>
          )}
        </span>
      </figcaption>
    </figure>
  );
}

/** ■ / □ register mark: filled = needs attention. */
export function Mark({ tone, on, children }: { tone: 'flag' | 'ok' | 'elev' | 'typ'; on?: boolean; children: ReactNode }) {
  return (
    <span className="rf-mark" data-tone={tone} data-on={on ? 'true' : undefined}>
      {children}
    </span>
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

/** Register colours. Ink = data, grey = context, blue = you are here, red = over a limit. */
export const TONE = {
  alert: 'var(--notice)',
  watch: 'var(--ochre-text)',
  ok: 'var(--within)',
  water: 'var(--register)',
  ink: 'var(--ink)',
  faint: 'var(--ink-3)',
} as const;
