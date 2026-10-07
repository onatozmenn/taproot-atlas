import { MapPinned } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TapAnswer } from '../../api';

export function EmptyState({ answer }: { answer: TapAnswer }) {
  const coverage = answer.coverage ?? [];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MapPinned className="size-5 text-muted-foreground" />
          <CardTitle className="font-display text-xl">
            {answer.place ? `"${answer.place}" is not covered yet` : 'Outside the snapshot'}
          </CardTitle>
        </div>
        <CardDescription>
          {answer.place
            ? 'The snapshot has no record for this place, so no other system is shown in its place.'
            : 'This area is outside the current snapshot.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h4 className="mb-1.5 text-sm font-medium">We only have data for:</h4>
          {coverage.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {coverage.map((c) => (
                <Badge key={c} variant="outline">
                  {c}
                </Badge>
              ))}
              <Badge variant="secondary">+ more US systems</Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Major US community water systems.</p>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Ask about one of these cities in plain words, or verify live records at the linked ECHO profile.
        </p>
      </CardContent>
    </Card>
  );
}
