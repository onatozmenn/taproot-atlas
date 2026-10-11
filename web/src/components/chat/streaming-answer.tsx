import { cloneElement, isValidElement, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { renderMarkdown } from '../../md';

/** Close an unbalanced **bold** run so a half-revealed token never shows raw asterisks. */
export function balance(prefix: string): string {
  const count = (prefix.match(/\*\*/g) ?? []).length;
  return count % 2 === 1 ? `${prefix}**` : prefix;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/**
 * Token boundaries for the stream: words with their trailing space, and
 * long words split into ~4-character pieces, the way a model emits tokens.
 * Returns cumulative character offsets, so `text.slice(0, ends[i])` is the
 * text after token i.
 */
export function tokenEnds(text: string): number[] {
  const ends: number[] = [];
  const re = /\S+\s*|\s+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index;
    const tok = m[0];
    if (tok.trim().length > 8) {
      for (let i = 4; i < tok.trimEnd().length; i += 4) ends.push(start + i);
    }
    ends.push(start + tok.length);
  }
  return ends;
}

/**
 * Stream pace: about 55 tokens a second, eased so the first words land
 * quickly and long answers never take more than 2.4 s. Returns how many
 * tokens to show `elapsed` ms after the answer arrived.
 */
export function tokensAt(elapsed: number, total: number): number {
  if (total <= 0) return 0;
  const duration = Math.min(2400, Math.max(450, total * 18));
  const t = Math.min(1, elapsed / duration);
  // easeOutSine: brisk start, gentle landing.
  const eased = Math.sin((t * Math.PI) / 2);
  return t >= 1 ? total : Math.max(1, Math.round(eased * total));
}

interface StreamingAnswerProps {
  markdown: string;
  /** Stream token by token (new answers). Old answers render instantly. */
  animate: boolean;
  onDone?: () => void;
  /** Inline cite tags, set at the end of the last paragraph once the text is in. */
  tail?: ReactNode;
}

/**
 * Streams the answer token by token with a soft droplet caret on the
 * leading edge, then hands off to the action row. The answer is announced
 * once on completion (aria-busy flips), never word by word.
 */
export function StreamingAnswer({ markdown, animate, onDone, tail }: StreamingAnswerProps) {
  const ends = useMemo(() => tokenEnds(markdown), [markdown]);
  const skip = !animate || prefersReducedMotion();
  const [count, setCount] = useState(skip ? ends.length : 0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (skip) {
      setCount(ends.length);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const n = tokensAt(t - t0, ends.length);
      setCount(n);
      if (n < ends.length) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [skip, ends.length]);

  const finished = count >= ends.length;
  useEffect(() => {
    if (finished && !doneRef.current) {
      doneRef.current = true;
      onDone?.();
    }
  }, [finished, onDone]);

  const visible = finished ? markdown : balance(markdown.slice(0, ends[count - 1] ?? 0));
  const nodes = renderMarkdown(visible);
  const caret = <span key="caret" className="cg-caret" aria-hidden="true" />;
  const extra = finished ? tail : caret;
  if (extra) {
    const last = nodes[nodes.length - 1];
    if (isValidElement(last) && last.type === 'p') {
      const el = last as ReactElement<{ children?: ReactNode }>;
      nodes[nodes.length - 1] = cloneElement(el, undefined, el.props.children, extra);
    } else {
      nodes.push(<p key="stream-tail">{extra}</p>);
    }
  }
  return (
    <div className="answer-prose" aria-busy={!finished} data-streaming={!finished || undefined}>
      {nodes}
    </div>
  );
}
