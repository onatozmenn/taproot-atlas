import type { LabAnalyteSummary } from '../../../../types/water-intelligence';
import { num } from './format';

function ngL(a: LabAnalyteSummary): number {
  if (a.maxInBenchmarkUnit !== undefined && a.benchmark?.unit === 'ng/L') return a.maxInBenchmarkUnit;
  const v = a.maxValue ?? 0;
  return /ug\/L|µg\/L/i.test(a.unit ?? '') ? v * 1000 : v;
}

/** Highest detection per PFAS compound (ng/L) against its 2024 federal limit. */
export function PfasChart({ rows }: { rows: LabAnalyteSummary[] }) {
  const detected = rows
    .filter((a) => a.detects > 0)
    .map((a) => ({ a, v: ngL(a) }))
    .sort((x, y) => y.v - x.v)
    .slice(0, 10);
  if (detected.length === 0) return null;
  const max = Math.max(...detected.map((d) => Math.max(d.v, d.a.benchmark?.value ?? 0))) * 1.1;
  return (
    <figure className="space-y-3">
      <figcaption className="text-sm font-medium">Highest result per compound, ng/L (parts per trillion)</figcaption>
      <ul className="space-y-2.5">
        {detected.map(({ a, v }) => {
          const lim = a.benchmark?.value;
          const above = lim !== undefined && v > lim;
          return (
            <li key={a.name} className="grid grid-cols-[88px_1fr_64px] items-center gap-3 text-sm">
              <span className="truncate font-medium" title={a.label}>{a.label}</span>
              <div className="relative h-3 rounded-full bg-secondary">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-[cubic-bezier(.22,1,.36,1)]"
                  style={{ width: `${Math.max(2, (v / max) * 100)}%`, background: above ? 'var(--level-alert)' : 'var(--chart-2)' }}
                />
                {lim !== undefined && (
                  <div
                    className="absolute -inset-y-1 w-0.5 rounded bg-foreground/70"
                    style={{ left: `${(lim / max) * 100}%` }}
                    title={`Federal limit ${lim} ng/L`}
                  />
                )}
              </div>
              <span className={`text-right tabular-nums ${above ? 'font-semibold text-[var(--level-alert)]' : ''}`}>{num(v)}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        The dark tick marks the 2024 federal limit where one exists (4 ng/L for PFOA and PFOS; 10 ng/L for PFHxS, PFNA and GenX).
      </p>
    </figure>
  );
}
