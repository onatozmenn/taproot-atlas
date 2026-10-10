import { useEffect, useState } from 'react';

/** True when the user asked the OS for less motion. Safe in tests/SSR. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

/** Format milliseconds the way the kit shows time: 0.4s, 12.8s, 1m 03s. */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${String(Math.floor(s % 60)).padStart(2, '0')}s`;
}

/** Live elapsed time since mount (or since `since`), ticking every 100 ms. */
export function useElapsed(running = true, since?: number): number {
  const [start] = useState(() => since ?? Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [running]);
  return now - start;
}

/** Advance through `count` stages, waiting `delays[i]` ms after stage i. Stops on the last. */
export function useStages(delays: number[], active = true): number {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!active || stage >= delays.length) return;
    const t = setTimeout(() => setStage((s) => s + 1), delays[stage]);
    return () => clearTimeout(t);
  }, [stage, delays, active]);
  return stage;
}

/**
 * Pixel width of a chart's box, so an SVG can draw in real pixels and its
 * labels stay readable on a 390 px phone instead of shrinking with a fixed
 * 640-unit viewBox. Falls back to `fallback` before layout (tests, SSR).
 */
export function useBoxWidth<T extends HTMLElement>(fallback = 640, min = 280, max = 760): [(el: T | null) => void, number] {
  const [el, setEl] = useState<T | null>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => {
      const next = Math.round(Math.min(max, Math.max(min, e.contentRect.width)));
      if (next > 0) setW((cur) => (Math.abs(cur - next) > 2 ? next : cur));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, min, max]);
  return [setEl, w];
}
