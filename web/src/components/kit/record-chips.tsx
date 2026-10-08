import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────
 * RECORD CHIPS — the datasets an answer touched, as compact
 * mono chips ("SDWIS · 2026 Q2"). A pulse dot marks a chip
 * whose record held something above a limit.
 * ───────────────────────────────────────────────────────── */

export interface RecordChip {
  name: string;
  detail?: string;
  href?: string;
  alert?: boolean;
}

export function RecordChips({ chips, className }: { chips: RecordChip[]; className?: string }) {
  if (chips.length === 0) return null;
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)} aria-label="Records read">
      {chips.map((c, i) => {
        const inner = (
          <>
            {c.alert && <span aria-hidden="true" className="kit-pulse size-1.5 rounded-full bg-[var(--level-alert)]" />}
            <span className="text-foreground">{c.name}</span>
            {c.detail && <span className="text-[var(--tertiary)]">{c.detail}</span>}
          </>
        );
        const cls = 'inline-flex h-7 items-center gap-1.5 rounded-lg border border-border bg-background px-2 font-mono text-[11.5px]';
        return (
          <li key={`${c.name}-${i}`} style={{ animation: `kit-pop-in 260ms var(--ease-out-quint) ${i * 50}ms both` }}>
            {c.href ? (
              <a href={c.href} target="_blank" rel="noreferrer" className={cn(cls, 'press hover:bg-secondary')}>
                {inner}
              </a>
            ) : (
              <span className={cls}>{inner}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
