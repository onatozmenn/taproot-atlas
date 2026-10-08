import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────
 * FOLLOW-UPS — next questions as quiet, hairline-separated
 * rows with a return arrow, staggering in once the answer
 * has finished streaming.
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
    <nav aria-label="Suggested follow-ups" className={cn('w-full', className)}>
      <p className="kit-fade-in text-[13px] font-medium text-muted-foreground">{title}</p>
      <ul className="mt-1 flex flex-col">
        {items.map((q, i) => (
          <li key={q} style={{ animation: `kit-fade-up 360ms var(--ease-out-quint) ${120 + i * 80}ms both` }}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(q)}
              className="press group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl border-b border-border px-2 py-3 text-left text-[16px] hover:bg-secondary disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5">
                <path d="m9 10-5 5 5 5" />
                <path d="M20 4v7a4 4 0 0 1-4 4H4" />
              </svg>
              <span className="min-w-0 flex-1">{q}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
