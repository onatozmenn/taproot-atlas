import { CheckIcon, CopyIcon, ExternalLinkIcon, ThumbsDownIcon, ThumbsUpIcon } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { TapAnswer } from '../../api';

export interface SourceLink {
  href: string;
  title: string;
  publisher: string;
}

function host(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return href;
  }
}

/** Every record the answer rests on, de-duplicated by URL. */
export function sourcesFor(answer: TapAnswer): SourceLink[] {
  const out: SourceLink[] = [];
  const add = (href: string | null | undefined, title: string, publisher: string) => {
    if (!href || !/^https?:\/\//.test(href) || out.some((s) => s.href === href)) return;
    out.push({ href, title, publisher });
  };
  if (answer.pwsid !== 'UNKNOWN') add(answer.echoUrl, `EPA ECHO compliance profile (${answer.pwsid})`, 'U.S. EPA');
  for (const m of [...answer.metrics, ...answer.lcr, ...answer.distribution, ...answer.syr, ...answer.ucmr]) {
    add(m.provenance.sourceDocumentUrl, `${m.provenance.reportPeriod} water quality report`, host(m.provenance.sourceDocumentUrl));
  }
  add(answer.facilityProvenanceUrl, 'SDWIS source facilities', 'U.S. EPA');
  add(answer.upstream?.sourceUrl, 'USGS upstream network (NLDI)', 'U.S. Geological Survey');
  add(answer.waterUse?.sourceUrl, 'USGS county water use estimate', 'U.S. Geological Survey');
  return out.slice(0, 8);
}

function Favicon({ href }: { href: string }) {
  const h = host(href);
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=64`}
      alt=""
      className="size-5 rounded-full border-2 border-background bg-background object-cover"
      loading="lazy"
    />
  );
}

function IconAction({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={pressed}
          className={cn(
            'press inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
            pressed && 'text-[var(--link)]',
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function AnswerActions({ answer, copyText }: { answer: TapAnswer; copyText: string }) {
  const sources = answer.scope === 'redirect' ? [] : sourcesFor(answer);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<'up' | 'down' | null>(null);
  const [thanks, setThanks] = useState(false);
  const [copied, setCopied] = useState(false);

  function rate(r: 'up' | 'down') {
    setRating((cur) => (cur === r ? null : r));
    setThanks(rating !== r);
    window.setTimeout(() => setThanks(false), 2200);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="animate-message-action-in relative mt-3 flex flex-wrap items-center gap-1">
      {sources.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="press mr-1 inline-flex h-9 items-center gap-2 rounded-full border border-border px-3.5 text-sm font-medium hover:bg-secondary"
          aria-label={`Sources, ${sources.length}`}
        >
          Sources
          <span className="flex -space-x-1.5" aria-hidden="true">
            {[...new Set(sources.map((s) => host(s.href)))].slice(0, 3).map((h) => (
              <Favicon key={h} href={`https://${h}`} />
            ))}
          </span>
        </button>
      )}
      <IconAction label={rating === 'up' ? 'Remove rating' : 'Good response'} pressed={rating === 'up'} onClick={() => rate('up')}>
        <ThumbsUpIcon className={cn('size-[18px]', rating === 'up' && 'fill-current')} />
      </IconAction>
      <IconAction label={rating === 'down' ? 'Remove rating' : 'Bad response'} pressed={rating === 'down'} onClick={() => rate('down')}>
        <ThumbsDownIcon className={cn('size-[18px]', rating === 'down' && 'fill-current')} />
      </IconAction>
      <IconAction label={copied ? 'Copied' : 'Copy'} onClick={() => void copy()}>
        {copied ? <CheckIcon className="size-[18px]" /> : <CopyIcon className="size-[18px]" />}
      </IconAction>
      {thanks && (
        <div
          role="status"
          className="animate-feedback-popover-in absolute bottom-11 left-0 z-10 rounded-2xl border bg-popover px-4 py-3 text-sm shadow-[var(--shadow-elevation-1)]"
        >
          <p className="font-semibold">Thank you</p>
          <p className="text-muted-foreground">Your feedback helps us improve.</p>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold tracking-tight">Sources</DialogTitle>
            <DialogDescription>Public records this answer is drawn from.</DialogDescription>
          </DialogHeader>
          <ul className="scrollbar-thin -mx-2 max-h-[60vh] space-y-1 overflow-y-auto">
            {sources.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="press flex items-start gap-3 rounded-2xl px-2 py-2.5 hover:bg-secondary"
                >
                  <Favicon href={s.href} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium leading-snug">{s.title}</span>
                    <span className="block truncate text-sm text-muted-foreground">{s.publisher}</span>
                  </span>
                  <ExternalLinkIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
