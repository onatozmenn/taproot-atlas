import { useState } from 'react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { TapAnswer } from '../../api';
import { SourceList, SourceToggle } from '../kit';
import { Check, Copy, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { sendFeedback } from '../../feedback';

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
        <button type="button" onClick={onClick} aria-label={label} aria-pressed={pressed} className={cn('cg-act', pressed && 'on')}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export interface AnswerActionsProps {
  answer: TapAnswer;
  copyText: string;
  sources?: SourceLink[];
  /** Controlled source list (the turn also opens it from cite tags). */
  open?: boolean;
  onToggleSources?: () => void;
  retrieved?: string;
  idPrefix?: string;
  highlight?: number | null;
  /** Ask the same question again (latest answer only). */
  onRegenerate?: () => void;
}

export function AnswerActions({ answer, copyText, sources: given, open: openProp, onToggleSources, retrieved, idPrefix, highlight, onRegenerate }: AnswerActionsProps) {
  const sources = given ?? (answer.scope === 'redirect' ? [] : sourcesFor(answer));
  const [openLocal, setOpenLocal] = useState(false);
  const open = openProp ?? openLocal;
  const toggle = onToggleSources ?? (() => setOpenLocal(!openLocal));
  const [rating, setRating] = useState<'up' | 'down' | null>(null);
  const [thanks, setThanks] = useState(false);
  const [copied, setCopied] = useState(false);

  function rate(r: 'up' | 'down') {
    if (rating !== r) sendFeedback({ kind: 'rating', rating: r, question: answer.question ?? '', pwsid: answer.pwsid, scope: answer.scope });
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
    <div className="animate-message-action-in flex flex-col">
      <div className="rc-acts cg-acts">
        <IconAction label={copied ? 'Copied' : 'Copy'} onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}
        </IconAction>
        <IconAction label={rating === 'up' ? 'Remove rating' : 'Good response'} pressed={rating === 'up'} onClick={() => rate('up')}>
          <ThumbsUp />
        </IconAction>
        <IconAction label={rating === 'down' ? 'Remove rating' : 'Bad response'} pressed={rating === 'down'} onClick={() => rate('down')}>
          <ThumbsDown />
        </IconAction>
        {onRegenerate && (
          <IconAction label="Regenerate" onClick={onRegenerate}>
            <RefreshCw />
          </IconAction>
        )}
        {sources.length > 0 && <SourceToggle sources={sources} open={open} onToggle={toggle} />}
        {thanks && (
          <div role="status" className="rc-toast animate-feedback-popover-in">
            <Check />
            <span>
              Thank you
              <small>Your rating helps fix the record.</small>
            </span>
          </div>
        )}
      </div>
      {sources.length > 0 && <SourceList sources={sources} open={open} onClose={toggle} retrieved={retrieved} idPrefix={idPrefix} highlight={highlight} />}
    </div>
  );
}
