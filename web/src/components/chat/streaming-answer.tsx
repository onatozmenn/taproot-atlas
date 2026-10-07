import { useEffect, useMemo, useRef, useState } from 'react';
import { renderMarkdown } from '../../md';

/** Close an unbalanced **bold** run so a half-revealed token never shows raw asterisks. */
function balance(prefix: string): string {
  const count = (prefix.match(/\*\*/g) ?? []).length;
  return count % 2 === 1 ? `${prefix}**` : prefix;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

interface StreamingAnswerProps {
  markdown: string;
  /** Reveal word by word (new answers). Old answers render instantly. */
  animate: boolean;
  onDone?: () => void;
}

/**
 * Streams the answer in like America.gov's follow-up responses: a few words
 * per frame with a soft blur-in on the leading edge, then hands off to the
 * action row and follow-up pills. The full text is in the DOM for screen
 * readers from the start (aria-live announces once on completion).
 */
export function StreamingAnswer({ markdown, animate, onDone }: StreamingAnswerProps) {
  const words = useMemo(() => markdown.split(/(\s+)/), [markdown]);
  const skip = !animate || prefersReducedMotion();
  const [count, setCount] = useState(skip ? words.length : 0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (skip) {
      setCount(words.length);
      return;
    }
    let raf = 0;
    let last = 0;
    const step = (t: number) => {
      if (t - last > 16) {
        last = t;
        // ~3 tokens per frame, a bit faster for long answers.
        setCount((c) => Math.min(words.length, c + (words.length > 220 ? 6 : 3)));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [skip, words.length]);

  const finished = count >= words.length;
  useEffect(() => {
    if (finished && !doneRef.current) {
      doneRef.current = true;
      onDone?.();
    }
  }, [finished, onDone]);

  const visible = finished ? markdown : balance(words.slice(0, count).join(''));
  return (
    <div className="answer-prose" aria-busy={!finished}>
      {renderMarkdown(visible)}
      {!finished && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[3px] bg-foreground/60 dot-pulse" aria-hidden="true" />}
    </div>
  );
}
