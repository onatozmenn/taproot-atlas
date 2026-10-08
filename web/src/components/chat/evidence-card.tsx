import { ChevronDownIcon } from 'lucide-react';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { TapAnswer } from '../../api';
import { ComplianceCard } from '../atlas/compliance-card';
import { EmptyState } from '../atlas/empty-state';
import { PathwaySchematic } from '../atlas/pathway-schematic';
import { QualityTable } from '../atlas/quality-table';
import { SourceCard } from '../atlas/source-card';
import { VisualAnswer } from '../visual/visual-answer';

type Tab = 'source' | 'quality' | 'pathway' | 'compliance';

function defaultTab(focus: TapAnswer['focus']): Tab {
  return focus === 'general' ? 'source' : focus;
}

/**
 * The records behind an answer as one rich inline card (America.gov's
 * "rich content" block): it rises in under the text, opens on the section
 * the question was about, and older answers keep it collapsed.
 */
export function EvidenceCard({ answer, initiallyOpen, onAsk }: { answer: TapAnswer; initiallyOpen: boolean; onAsk?: (q: string) => void }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [tab, setTab] = useState<Tab>(defaultTab(answer.focus));

  if (answer.scope === 'redirect') return null;
  if (answer.profile && answer.pwsid !== 'UNKNOWN') return <VisualAnswer answer={answer} onAsk={onAsk} />;
  if (answer.pwsid === 'UNKNOWN') {
    return answer.place ? (
      <div className="animate-rich-content-in mt-4">
        <EmptyState answer={answer} />
      </div>
    ) : null;
  }

  return (
    <div className="evidence animate-rich-content-in mt-4 overflow-hidden rounded-3xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="press flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-secondary/60"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{answer.systemName}</span>
          <span className="block text-sm text-muted-foreground">
            PWSID {answer.pwsid} · source, lab results, route and EPA record
          </span>
        </span>
        <ChevronDownIcon className={cn('size-5 shrink-0 text-muted-foreground transition-transform duration-300', open && 'rotate-180')} />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(.22,1,.36,1)]',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t px-3 pb-4 pt-3 sm:px-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
              <TabsList className="mb-3 grid h-11 w-full grid-cols-4 rounded-full p-1" aria-label="Record sections">
                <TabsTrigger value="source" className="rounded-full">Source</TabsTrigger>
                <TabsTrigger value="quality" className="rounded-full">Quality</TabsTrigger>
                <TabsTrigger value="pathway" className="rounded-full">Pathway</TabsTrigger>
                <TabsTrigger value="compliance" className="rounded-full">EPA record</TabsTrigger>
              </TabsList>
              <TabsContent value="source" className="animate-message-action-in">
                <SourceCard answer={answer} />
              </TabsContent>
              <TabsContent value="quality" className="animate-message-action-in">
                <QualityTable answer={answer} />
              </TabsContent>
              <TabsContent value="pathway" className="animate-message-action-in">
                <PathwaySchematic answer={answer} />
              </TabsContent>
              <TabsContent value="compliance" className="animate-message-action-in">
                <ComplianceCard answer={answer} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
