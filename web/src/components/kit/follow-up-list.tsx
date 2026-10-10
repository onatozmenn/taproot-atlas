import { cn } from '@/lib/utils';
import { RcArrow } from '../chat/rc-icons';
import '../../styles/record-chat.css';

/* ─────────────────────────────────────────────────────────
 * FOLLOW-UPS — next questions as numbered register rows
 * (Q1, Q2, Q3) under an ink rule, arrow in register blue.
 * ───────────────────────────────────────────────────────── */

export interface FollowUpListProps {
  items: string[];
  onPick: (q: string) => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}

export function FollowUpList({ items, onPick, disabled, title = 'Ask next', className }: FollowUpListProps) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Suggested follow-ups" className={cn('rc-fups', className)}>
      <span className="rc-lbl">{title}</span>
      <ul>
        {items.map((q, i) => (
          <li key={q} style={{ animation: `kit-fade-up 320ms var(--ease-out-quint) ${80 + i * 70}ms both` }}>
            <button type="button" aria-label={q} disabled={disabled} onClick={() => onPick(q)} className="rc-fup">
              <span className="n" aria-hidden="true">
                Q{i + 1}
              </span>
              <span>{q}</span>
              <RcArrow />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
