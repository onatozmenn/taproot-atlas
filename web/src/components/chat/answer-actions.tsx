import { CheckIcon, CopyIcon, ThumbsDownIcon, ThumbsUpIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { TapAnswer } from '../../api';
import { SourceList, SourceToggle } from '../kit';

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
  if (answer.profile) {
    add(answer.profile.provenance.sdwisUrl, `SDWIS federal data, ${answer.profile.provenance.sdwisQuarter ?? 'latest quarter'} (ECHO bulk download)`, 'U.S. EPA');
    if (answer.profile.lab.some((a) => a.dataset === 'SYR4')) add(answer.profile.provenance.syr4Url, 'Six-Year Review 4 compliance monitoring, 2012-2019', 'U.S. EPA');
    if (answer.profile.pfas.tested) add(answer.profile.provenance.ucmr5Url, 'UCMR 5 PFAS and lithium occurrence, 2023-2025', 'U.S. EPA');
  }
  add(answer.facilityProvenanceUrl, 'SDWIS source facilities', 'U.S. EPA');
  add(answer.upstream?.sourceUrl, 'USGS upstream network (NLDI)', 'U.S. Geological Survey');
  add(answer.waterUse?.sourceUrl, 'USGS county water use estimate', 'U.S. Geological Survey');
  return out.slice(0, 8);
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
      toast.success('Answer copied');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      toast.error('Could not copy. Select the text and copy it instead.');
    }
  }

  return (
    <div className="animate-message-action-in relative mt-3 flex flex-wrap items-center gap-1">
      {sources.length > 0 && <SourceToggle sources={sources} open={open} onToggle={() => setOpen(!open)} />}
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
      {sources.length > 0 && <SourceList sources={sources} open={open} />}
    </div>
  );
}
