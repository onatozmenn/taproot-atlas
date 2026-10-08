import { ExternalLinkIcon } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────
 * SOURCE STACK — overlapping favicons + "N sources"
 *
 * A quiet pill in the answer's action row. Tapping it folds
 * the record list open in place (no dialog), each row naming
 * the record, its publisher and its domain.
 * CITE PILL — the same source as a tiny inline chip.
 * ───────────────────────────────────────────────────────── */

export interface SourceItem {
  href: string;
  title: string;
  publisher: string;
}

export function hostOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return href;
  }
}

export function Favicon({ href, className }: { href: string; className?: string }) {
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(href))}&sz=64`}
      alt=""
      loading="lazy"
      className={cn('size-4 rounded-full bg-background object-cover', className)}
    />
  );
}

export function SourceToggle({ sources, open, onToggle }: { sources: SourceItem[]; open: boolean; onToggle: () => void }) {
  const hosts = [...new Set(sources.map((s) => hostOf(s.href)))].slice(0, 3);
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className={cn('press mr-1 inline-flex h-9 items-center gap-2 rounded-full border border-border px-3 text-sm font-medium hover:bg-secondary', open && 'bg-secondary')}
    >
      <span className="flex -space-x-1.5" aria-hidden="true">
        {hosts.map((h) => (
          <Favicon key={h} href={`https://${h}`} className="size-5 border-2 border-background" />
        ))}
      </span>
      {sources.length} {sources.length === 1 ? 'source' : 'sources'}
    </button>
  );
}

export function SourceList({ sources, open }: { sources: SourceItem[]; open: boolean }) {
  return (
    <div
      className="grid w-full transition-[grid-template-rows,opacity] duration-300"
      style={{ gridTemplateRows: open ? '1fr' : '0fr', opacity: open ? 1 : 0, transitionTimingFunction: 'var(--ease-out-quint)' }}
      aria-hidden={!open}
    >
      <div className="overflow-hidden">
        <ul className="mt-2 flex flex-col rounded-2xl border border-border p-1.5" aria-label="Sources">
          {sources.map((s, i) => (
            <li key={s.href} style={open ? { animation: `kit-fade-up 300ms var(--ease-out-quint) ${i * 40}ms both` } : undefined}>
              <a
                href={s.href}
                target="_blank"
                rel="noreferrer"
                tabIndex={open ? 0 : -1}
                className="press group flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-secondary"
              >
                <Favicon href={s.href} className="size-5" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium leading-snug group-hover:underline group-hover:underline-offset-2">{s.title}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{s.publisher}</span>
                </span>
                <span className="hidden shrink-0 font-mono text-[11.5px] text-[var(--tertiary)] sm:block">{hostOf(s.href)}</span>
                <ExternalLinkIcon className="size-3.5 shrink-0 text-[var(--tertiary)]" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Self-contained toggle + list, for places that don't share a row. */
export function SourceStack({ sources, defaultOpen = false }: { sources: SourceItem[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (sources.length === 0) return null;
  return (
    <div className="flex flex-col items-start">
      <SourceToggle sources={sources} open={open} onToggle={() => setOpen(!open)} />
      <SourceList sources={sources} open={open} />
    </div>
  );
}

export function CitePill({ source }: { source: SourceItem }) {
  return (
    <a
      href={source.href}
      target="_blank"
      rel="noreferrer"
      title={source.title}
      className="kit-pop-in mx-0.5 inline-flex h-[22px] translate-y-[-2px] items-center gap-1 rounded-md bg-secondary px-1.5 align-middle font-mono text-[11.5px] text-muted-foreground no-underline hover:text-foreground"
    >
      <Favicon href={source.href} className="size-3 rounded-[3px]" />
      {hostOf(source.href)}
    </a>
  );
}
