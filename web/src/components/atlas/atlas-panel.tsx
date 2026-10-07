import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TapAnswer } from '../../api';
import { ComplianceCard } from './compliance-card';
import { EmptyState } from './empty-state';
import { PathwaySchematic } from './pathway-schematic';
import { QualityTable } from './quality-table';
import { SourceCard } from './source-card';

export type AtlasTab = 'source' | 'quality' | 'pathway' | 'compliance';

interface AtlasPanelProps {
  answer: TapAnswer | null;
  tab: AtlasTab;
  onTabChange: (tab: AtlasTab) => void;
  loading: boolean;
}

export function AtlasPanel({ answer, tab, onTabChange, loading }: AtlasPanelProps) {
  if (!answer) {
    return (
      <div className="space-y-3" aria-label="Atlas panel loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (answer.scope === 'redirect') {
    return (
      <div className="space-y-3">
        {loading && <Skeleton className="h-2 w-full" aria-label="Loading next answer" />}
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Ask about tap water to fill this panel with source, quality, pathway, and compliance records.
        </p>
      </div>
    );
  }
  if (answer.pwsid === 'UNKNOWN') {
    return (
      <div className="space-y-3">
        {loading && <Skeleton className="h-2 w-full" aria-label="Loading next answer" />}
        <EmptyState answer={answer} />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {loading && <Skeleton className="h-2 w-full" aria-label="Loading next answer" />}
      <Tabs value={tab} onValueChange={(v) => onTabChange(v as AtlasTab)}>
        <TabsList className="grid w-full grid-cols-4" aria-label="Atlas sections">
          <TabsTrigger value="source">Source</TabsTrigger>
          <TabsTrigger value="quality">Water quality</TabsTrigger>
          <TabsTrigger value="pathway">Pathway</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>
        <TabsContent value="source">
          <SourceCard answer={answer} />
        </TabsContent>
        <TabsContent value="quality">
          <QualityTable answer={answer} />
        </TabsContent>
        <TabsContent value="pathway">
          <PathwaySchematic answer={answer} />
        </TabsContent>
        <TabsContent value="compliance">
          <ComplianceCard answer={answer} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
