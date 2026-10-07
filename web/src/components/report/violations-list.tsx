import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { WaterSystemProfile } from '../../../../types/water-intelligence';
import { day, titleCase } from './format';

/** EPA SDWIS violation history as a dated timeline. */
export function ViolationsList({ p }: { p: WaterSystemProfile }) {
  const [healthOnly, setHealthOnly] = useState(false);
  const v = p.violationSummary;
  const rows = p.violations.filter((x) => !healthOnly || x.healthBased);
  const stats = [
    { label: 'Last 5 years', value: v.last5Years },
    { label: 'Health-based, 5 yrs', value: v.healthBased5Years, alert: v.healthBased5Years > 0 },
    { label: 'Not yet resolved', value: v.unresolved, alert: v.unresolved > 0 },
    { label: 'All-time records', value: v.total },
  ];
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-muted px-3.5 py-3">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className={cn('text-2xl font-semibold tabular-nums', s.alert && 'text-[var(--level-alert)]')}>{s.value}</dd>
          </div>
        ))}
      </dl>
      {p.lastSanitarySurvey?.date && (
        <p className="text-sm">
          <span className="font-medium">Last state inspection:</span> {day(p.lastSanitarySurvey.date)}
          {p.lastSanitarySurvey.findings.some((f) => f.startsWith('significant')) ? (
            <span className="text-[var(--level-alert)]">
              {' '}
              · {p.lastSanitarySurvey.findings.filter((f) => f.startsWith('significant')).map((f) => f.replace('significant deficiency: ', '')).join(', ')} flagged as significant deficiencies
            </span>
          ) : (
            <span className="text-muted-foreground"> · no significant deficiencies</span>
          )}
        </p>
      )}
      {p.violations.length > 0 && (
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Most recent records</h4>
          <button
            type="button"
            aria-pressed={healthOnly}
            onClick={() => setHealthOnly((x) => !x)}
            className={cn(
              'press h-8 rounded-full border px-3 text-[13px] font-medium',
              healthOnly ? 'border-foreground bg-foreground text-background' : 'hover:bg-secondary',
            )}
          >
            Health-based only
          </button>
        </div>
      )}
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          {p.violations.length === 0 ? 'EPA lists no violations for this system.' : 'No health-based violations in the recent records.'}
        </p>
      ) : (
        <ol className="relative space-y-0">
          {rows.slice(0, 12).map((x, i) => {
            const open = !x.returnedToCompliance && x.status !== 'Resolved' && x.status !== 'Archived';
            return (
              <li key={x.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < Math.min(rows.length, 12) - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-border" aria-hidden="true" />}
                <span
                  className="relative mt-1.5 size-[11px] shrink-0 rounded-full border-2"
                  style={{
                    borderColor: x.healthBased ? 'var(--level-alert)' : 'var(--tertiary)',
                    background: open ? (x.healthBased ? 'var(--level-alert)' : 'var(--tertiary)') : 'var(--background)',
                  }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium leading-snug">{x.name ?? x.contaminant ?? 'Violation'}</p>
                  <p className="text-sm text-muted-foreground">
                    {day(x.begin)}
                    {x.contaminant && x.name && !x.name.toLowerCase().includes(x.contaminant.toLowerCase()) ? ` · ${titleCase(x.contaminant)}` : ''}
                    {x.facility ? ` · ${x.facility}` : ''}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 font-medium',
                        x.healthBased ? 'bg-[var(--level-alert-bg)] text-[var(--level-alert)]' : 'bg-secondary text-muted-foreground',
                      )}
                    >
                      {x.healthBased ? 'Health-based' : x.category ?? 'Monitoring or reporting'}
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 font-medium', open ? 'bg-[var(--level-watch-bg)] text-[var(--level-watch)]' : 'bg-[var(--level-ok-bg)] text-[var(--level-ok)]')}>
                      {open ? 'Open' : x.returnedToCompliance ? `Resolved ${day(x.returnedToCompliance)}` : 'Resolved'}
                    </span>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
