import { cn } from '@/lib/utils';
import { formatElapsed, useElapsed, useReducedMotion } from './motion';
import '../../styles/record-chat.css';

/* ─────────────────────────────────────────────────────────
 * RECORD LOADER — a ticking rule, not a spinner
 *
 * An ink drop beside a ruled scale; the register-blue bar
 * advances one tick per record read. With no known progress
 * it runs along the scale in steps. Reduced motion holds it.
 * ───────────────────────────────────────────────────────── */

export type DropLoaderVariant = 'rain' | 'ripple' | 'flow';

function Drop() {
  return (
    <svg className="drop" viewBox="0 0 22 28" aria-hidden="true">
      <path d="M11 1.5c3.6 4.6 8.5 9.6 8.5 15a8.5 8.5 0 0 1-17 0c0-5.4 4.9-10.4 8.5-15z" fill="none" stroke="var(--ink)" strokeWidth="1.6" />
      <rect x="2.5" y="17" width="17" height="2" fill="var(--register)" />
    </svg>
  );
}

/** Small inline scale (kept for callers of the old droplet grid). */
export function DropGrid({ className }: { variant?: DropLoaderVariant; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('rc-loader run inline', className)} style={{ minWidth: 48, padding: 0 }}>
      <span className="rail" style={{ gridColumn: '1 / -1', width: 48 }}>
        <i />
      </span>
    </span>
  );
}

export function RecordLoader({ label, progress, right, className }: { label: string; progress?: number; right?: string; className?: string }) {
  const reduced = useReducedMotion();
  const known = typeof progress === 'number';
  return (
    <div className={cn('rc-loader', !known && !reduced && 'run', className)}>
      <Drop />
      <div className="rail">
        <i style={known ? { width: `${Math.round(Math.min(1, Math.max(0.04, progress)) * 100)}%` } : reduced ? { width: '40%' } : undefined} />
      </div>
      <div className="cap">
        <span key={label}>{label}</span>
        {right && <span>{right}</span>}
      </div>
    </div>
  );
}

export interface DropLoaderProps {
  label?: string;
  variant?: DropLoaderVariant;
  /** Show the live elapsed timer (default true). */
  showElapsed?: boolean;
  /** 0–1 when the number of records is known. */
  progress?: number;
  className?: string;
}

export function DropLoader({ label = 'Reading the records', showElapsed = true, progress, className }: DropLoaderProps) {
  const elapsed = useElapsed();
  return (
    <div role="status" aria-live="polite" className={cn('w-full max-w-[420px]', className)}>
      <RecordLoader label={`${label}…`} progress={progress} right={showElapsed ? formatElapsed(elapsed) : undefined} />
    </div>
  );
}
