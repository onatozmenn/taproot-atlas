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
