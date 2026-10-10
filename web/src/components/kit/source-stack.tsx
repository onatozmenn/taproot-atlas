import { useState } from 'react';
import { cn } from '@/lib/utils';
import { RcExt } from '../chat/rc-icons';
import '../../styles/record-chat.css';

/* ─────────────────────────────────────────────────────────
 * SOURCE STACK — the records an answer rests on (Public Record)
 *
 * In the action row: square initials ("E S U") + "3 sources"
 * + the short tags in mono. Opens a numbered register of the
 * records in place. The same register sits in the margin
 * column on wide screens. CITE TAG — "[SDWIS]" inline.
 * ───────────────────────────────────────────────────────── */

export interface SourceItem {
  href: string;
  title: string;
  publisher: string;
  /** Short register tag ("SDWIS", "UCMR 5"). */
  tag?: string;
}

export function hostOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return href;
  }
}

/** Short tag for a source: the dataset name the record is filed under. */
export function tagOf(s: SourceItem): string {
  if (s.tag) return s.tag;
  const t = `${s.title} ${s.href}`;
  if (/UCMR/i.test(t)) return 'UCMR 5';
  if (/Six-Year|SYR/i.test(t)) return 'SYR4';
  if (/^LCR|Lead and Copper|Lead & Copper/i.test(s.title)) return 'LCR';
  if (/SDWIS/i.test(t)) return 'SDWIS';
  if (/NLDI|upstream/i.test(t)) return 'USGS NLDI';
  if (/USGS|water use/i.test(t)) return 'USGS';
  if (/ECHO/i.test(s.title)) return 'ECHO';
  if (/quality report|CCR/i.test(s.title)) return 'CCR';
  if (/echo\.epa/i.test(s.href)) return 'ECHO';
  return hostOf(s.href).split('.')[0].toUpperCase();
}

/** Kept for older callers: a square initial instead of a remote favicon. */
export function Favicon({ href, className }: { href: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('inline-grid size-4 place-items-center border border-[var(--ink)] font-mono text-[9px]', className)}>
      {hostOf(href).slice(0, 1).toUpperCase()}
    </span>
  );
}

export function SourceToggle({ sources, open, onToggle }: { sources: SourceItem[]; open: boolean; onToggle: () => void }) {
  const tags = [...new Set(sources.map(tagOf))];
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault();
          onToggle();
        }
      }}
      className="rc-srcstack"
    >
      <span className="sq" aria-hidden="true">
        {tags.slice(0, 3).map((t) => (
          <span key={t}>{t.slice(0, 1)}</span>
        ))}
      </span>
      {sources.length} {sources.length === 1 ? 'source' : 'sources'}
      <em aria-hidden="true">{tags.slice(0, 3).join(' · ')}</em>
    </button>
  );
}

export function SourceRegister({
  sources,
  retrieved,
  idPrefix,
  highlight,
  tabbable = true,
  className,
}: {
  sources: SourceItem[];
  retrieved?: string;
  idPrefix?: string;
  highlight?: number | null;
  tabbable?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('rc-srcs', className)}>
      <div className="rc-srcs-h">
        <h4>Sources</h4>
        <span className="rc-lbl">
          {sources.length} {sources.length === 1 ? 'record' : 'records'}
        </span>
      </div>
      <ol aria-label="Sources">
        {sources.map((s, i) => (
          <li key={s.href}>
            <a
              id={idPrefix ? `${idPrefix}-${i + 1}` : undefined}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              tabIndex={tabbable ? 0 : -1}
              className={cn('rc-src', highlight === i && 'hl')}
            >
              <span className="n">{i + 1}</span>
              <span className="min-w-0">
                <b>{s.title}</b>
                <span className="d">
                  {tagOf(s)} · {s.publisher}
                  {retrieved ? ' · ' : ''}
                  {retrieved && <span className="dt">Retrieved {retrieved}</span>}
                </span>
              </span>
              <RcExt />
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SourceList({
  sources,
  open,
  onClose,
  retrieved,
  idPrefix,
  highlight,
}: {
  sources: SourceItem[];
  open: boolean;
  onClose?: () => void;
  retrieved?: string;
  idPrefix?: string;
  highlight?: number | null;
}) {
  return (
    <div
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open && onClose) {
          e.preventDefault();
          onClose();
        }
      }}
      className="rc-fold rc-srclist-inline w-full"
      style={{ gridTemplateRows: open ? '1fr' : '0fr', opacity: open ? 1 : 0 }}
      aria-hidden={!open}
    >
      <div {...(open ? {} : { inert: '' as unknown as boolean })}>
        <SourceRegister sources={sources} retrieved={retrieved} idPrefix={idPrefix} highlight={highlight} tabbable={open} className="mt-3" />
      </div>
    </div>
  );
}

/** Self-contained toggle + list, for places that don't share a row. */
export function SourceStack({ sources, defaultOpen = false }: { sources: SourceItem[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (sources.length === 0) return null;
  return (
    <div className="flex w-full flex-col items-start">
      <SourceToggle sources={sources} open={open} onToggle={() => setOpen(!open)} />
      <SourceList sources={sources} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

export function CitePill({ source, onClick }: { source: SourceItem; onClick?: () => void }) {
  const tag = `[${tagOf(source)}]`;
  if (onClick)
    return (
      <button type="button" className="rc-cite" title={source.title} aria-label={`Source: ${source.title}`} onClick={onClick}>
        {tag}
      </button>
    );
  return (
    <a href={source.href} target="_blank" rel="noreferrer" title={source.title} className="rc-cite">
      {tag}
    </a>
  );
}
