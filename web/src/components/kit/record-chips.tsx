import { cn } from '@/lib/utils';
import '../../styles/record-chat.css';

/* ─────────────────────────────────────────────────────────
 * RECORD CHIPS — facts from the record as a register of
 * hairline cells: mono label over the value. A solid square
 * marks a cell whose record held something above a limit.
 * ───────────────────────────────────────────────────────── */

export interface RecordChip {
  /** Cell label ("Served", "PWSID"). */
  name: string;
  /** Cell value ("81,252 people"). */
  detail?: string;
  href?: string;
  alert?: boolean;
  /** Set the value in mono (IDs, dates). */
  mono?: boolean;
}

export function RecordChips({ chips, className, label = 'Records read' }: { chips: RecordChip[]; className?: string; label?: string }) {
  if (chips.length === 0) return null;
  return (
    <ul className={cn('rc-facts', className)} aria-label={label}>
      {chips.map((c, i) => (
        <li key={`${c.name}-${i}`} className={cn('rc-fact', c.alert && 'alert')}>
          <span className="rc-lbl">{c.name}</span>
          {c.href ? (
            <a href={c.href} target="_blank" rel="noreferrer" className={cn('v', c.mono && 'm')}>
              {c.detail ?? c.name}
            </a>
          ) : (
            <span className={cn('v', c.mono && 'm')}>{c.detail ?? '—'}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
