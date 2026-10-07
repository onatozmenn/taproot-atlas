import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TapAnswer } from '../../api';

function tierText(answer: TapAnswer): string {
  switch (answer.recordTier) {
    case 'unknown-pending':
      return 'Compliance records are not yet curated for this window.';
    case 'none-found':
      return `No violations found in the ${answer.windowStart} to ${answer.windowEnd} window.`;
    case 'monitoring-only':
      return `Only monitoring and reporting violations on record in the ${answer.windowStart} to ${answer.windowEnd} window.`;
    case 'other':
      return `Other violations on record in the ${answer.windowStart} to ${answer.windowEnd} window (not health-based, not monitoring-only). Check the linked ECHO profile for categories.`;
    case 'health-based':
      return `Health-based violations on record in the ${answer.windowStart} to ${answer.windowEnd} window.`;
  }
}

export function ComplianceCard({ answer }: { answer: TapAnswer }) {
  const processes = answer.treatment?.processes ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">Regulatory compliance</CardTitle>
        <CardDescription>EPA SDWIS record-keeping for the monitored window.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Monitored period</dt>
            <dd className="font-medium">
              {answer.windowStart} to {answer.windowEnd}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Violations recorded</dt>
            <dd className="font-medium">
              {answer.compliancePending ? 'Not yet curated' : answer.violations}
            </dd>
          </div>
        </dl>
        <p className="text-sm">{tierText(answer)}</p>
        {processes.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-sm font-medium">Reported treatment steps</h4>
            <div className="flex flex-wrap gap-1.5" aria-label="Reported treatment processes">
              {processes.map((p) => (
                <Badge key={p} variant="secondary">
                  {p.toLowerCase().replace(/(^|\s|-)(\S)/g, (m) => m.toUpperCase())}
                </Badge>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={answer.echoUrl} target="_blank" rel="noreferrer">
              {answer.compliancePending ? 'Verify live records at EPA ECHO' : 'Access EPA ECHO system profile'}{' '}
              <ExternalLink className="ml-1 size-3.5" />
            </a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Record verified at: {answer.verifiedAt}</p>
      </CardContent>
    </Card>
  );
}
