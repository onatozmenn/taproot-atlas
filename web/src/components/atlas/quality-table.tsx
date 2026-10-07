import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { TapAnswer } from '../../api';
import type { QualityMetricRecord } from '../../../../types/water-intelligence';

function statusBadge(status: QualityMetricRecord['complianceStatus']) {
  switch (status) {
    case 'within_standard':
      return <Badge className="whitespace-nowrap bg-emerald-600 text-white hover:bg-emerald-600">Within standard</Badge>;
    case 'exceeds_standard':
      return <Badge variant="destructive" className="whitespace-nowrap">Exceeds standard</Badge>;
    default:
      return <Badge className="whitespace-nowrap bg-amber-500 text-white hover:bg-amber-500">Monitoring</Badge>;
  }
}

function shortDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function MetricTable({ metrics }: { metrics: QualityMetricRecord[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Parameter</TableHead>
          <TableHead>Reported</TableHead>
          <TableHead>Standard</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Tested</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {metrics.map((m) => (
          <TableRow key={m.parameter}>
            <TableCell>
              <a
                className="font-medium text-primary underline-offset-4 hover:underline"
                href={m.provenance.sourceDocumentUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`Verify ${m.parameter} filing`}
              >
                {m.parameter}
              </a>
            </TableCell>
            <TableCell className="whitespace-nowrap">{m.reportedValue}</TableCell>
            <TableCell className="whitespace-nowrap">{m.regulatoryThreshold}</TableCell>
            <TableCell>{statusBadge(m.complianceStatus)}</TableCell>
            <TableCell className="whitespace-nowrap">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help underline decoration-dotted underline-offset-2">
                    {shortDate(m.testDate)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {m.testDate} · {m.provenance.reportPeriod}
                    <br />
                    Ingested {m.provenance.captureTime} · {m.provenance.sourceVersionId}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function QualityTable({ answer }: { answer: TapAnswer }) {
  const extra = [...(answer.lcr ?? []), ...(answer.ucmr ?? []), ...(answer.syr ?? []), ...(answer.distribution ?? [])];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">Reported quality</CardTitle>
        <CardDescription>Laboratory results as reported, with the regulatory benchmark for each row.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <TriangleAlert className="size-4" />
          <AlertDescription>
            Reports only. Never a safety verdict. Verify at the official source.
          </AlertDescription>
        </Alert>
        {answer.metrics.length > 0 ? (
          <MetricTable metrics={answer.metrics} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No reported lab metrics are available for this system in the current snapshot.
          </p>
        )}
        {extra.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">More monitoring extracts (LCR / UCMR / SYR / distribution)</h4>
            <MetricTable metrics={extra} />
            {(answer.ucmr ?? []).length > 0 && (
              <p className="text-xs text-muted-foreground">
                UCMR rows are occurrence findings, not federal MCL violations unless the threshold names an MCL.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
