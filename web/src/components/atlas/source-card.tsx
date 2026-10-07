import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TapAnswer } from '../../api';

export function SourceCard({ answer }: { answer: TapAnswer }) {
  const facilities = answer.facilities ?? [];
  const sellers = answer.sellerChain ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">Water source</CardTitle>
        <CardDescription>
          {answer.systemName} · <Badge variant="secondary">{answer.pwsid}</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="mb-1.5 text-sm font-medium">Source basins</h4>
          {answer.basins.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {answer.basins.map((b) => (
                <Badge key={b} variant="outline">
                  {b}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Source basins are not yet curated for this system in the snapshot.
            </p>
          )}
        </div>
        {facilities.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-sm font-medium">Reported facilities (SDWIS)</h4>
            <ul className="space-y-1.5">
              {facilities.slice(0, 6).map((f) => (
                <li key={f.facilityName} className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="font-medium">{f.facilityName}</span>
                  <Badge variant="outline">{f.facilityType}</Badge>
                  {f.waterType && <Badge variant="secondary">{f.waterType}</Badge>}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Schematic labels only; intake coordinates are never published.
            </p>
          </div>
        )}
        {sellers.length > 0 && (
          <p className="text-sm">
            Purchased-water chain:{' '}
            {sellers.map((s) => `${s.systemName} (${s.pwsid})`).join('; ')}.
          </p>
        )}
        {answer.facilityProvenanceUrl && (
          <Button variant="outline" size="sm" asChild>
            <a href={answer.facilityProvenanceUrl} target="_blank" rel="noreferrer">
              Verify at EPA <ExternalLink className="ml-1 size-3.5" />
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
