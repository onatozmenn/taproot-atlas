import { Droplets, Factory, Home, Mountain, MoveRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TapAnswer } from '../../api';
import { RealMap } from '../RealMap';

const ROLE_ICON: Record<string, typeof Mountain> = {
  watershed: Mountain,
  treatment_facility: Factory,
  distribution_zone: Home,
};

function StepIcon({ role }: { role: string }) {
  const Icon = ROLE_ICON[role] ?? Droplets;
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
      <Icon className="size-5" />
    </span>
  );
}

export function PathwaySchematic({ answer }: { answer: TapAnswer }) {
  const steps = answer.flow;
  const conveyances = answer.conveyances ?? [];
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Source-to-tap pathway</CardTitle>
          <CardDescription>
            Schematic order only; paths are approximations, never engineering alignments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.length > 0 ? (
            <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch" aria-label="Schematic water pathway">
              {steps.map((s, i) => (
                <li key={`${s.label}-${i}`} className="flex flex-1 items-center gap-2">
                  {i > 0 && <MoveRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />}
                  <div className="flex flex-1 items-center gap-2.5 rounded-lg border p-2.5">
                    <StepIcon role={s.role} />
                    <span className="text-sm font-medium">{s.label}</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No curated pathway is available for this system.</p>
          )}
          {conveyances.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm text-muted-foreground">Large conveyances (schematic):</span>
              {conveyances.map((c) => (
                <Badge key={c.name} variant="outline">
                  {c.name}
                </Badge>
              ))}
            </div>
          )}
          {answer.treatment?.rigor ? (
            <p className="text-sm">
              Reported treatment: <span className="font-medium">{answer.treatment.rigor}.</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No treatment profile available.</p>
          )}
          {answer.upstream && (
            <p className="text-sm text-muted-foreground">
              Upstream context near {answer.upstream.outletLabel}: {answer.upstream.upstreamCount} flowlines and{' '}
              {answer.upstream.stationCount} pre-treatment monitoring stations in range. Pre-treatment context only.
            </p>
          )}
        </CardContent>
      </Card>
      <RealMap answer={answer} />
    </div>
  );
}
