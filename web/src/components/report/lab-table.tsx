import { SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { LabAnalyteSummary } from '../../../../types/water-intelligence';
import { num, unit, year } from './format';

const GROUPS: Array<{ key: string; label: string; match: (a: LabAnalyteSummary) => boolean }> = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'pfas', label: 'PFAS', match: (a) => a.group === 'pfas' },
  { key: 'metals', label: 'Metals', match: (a) => a.group === 'metals_inorganics' || a.group === 'metals' },
  { key: 'nutrients', label: 'Nitrate & fluoride', match: (a) => a.group === 'nutrients_inorganics' },
  { key: 'dbp', label: 'Byproducts', match: (a) => a.group === 'disinfection_byproducts' },
  { key: 'disinfectant', label: 'Disinfectant', match: (a) => a.group === 'disinfectant_residual' },
  { key: 'rad', label: 'Radioactive', match: (a) => a.group === 'radionuclides' },
  { key: 'organic', label: 'Organics', match: (a) => a.group === 'organic_chemicals' },
];

function Status({ a }: { a: LabAnalyteSummary }) {
  const map: Record<LabAnalyteSummary['status'], [string, string]> = {
    max_above_benchmark: ['Some samples above limit', 'bg-[var(--level-alert-bg)] text-[var(--level-alert)]'],
    below_benchmark: ['Under limit', 'bg-[var(--level-ok-bg)] text-[var(--level-ok)]'],
    detected: ['Detected, no limit', 'bg-[var(--level-watch-bg)] text-[var(--level-watch)]'],
    not_detected: ['Not detected', 'bg-secondary text-muted-foreground'],
  };
  const [text, cls] = map[a.status];
  return <span className={cn('inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', cls)}>{text}</span>;
}

/** Every analyte EPA has for this system, searchable and filterable. */
export function LabTable({ rows }: { rows: LabAnalyteSummary[] }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const [onlyDetected, setOnlyDetected] = useState(true);
  const groups = GROUPS.filter((g) => g.key === 'all' || rows.some(g.match));
  const shown = useMemo(() => {
    const g = GROUPS.find((x) => x.key === group) ?? GROUPS[0];
    const rank = (a: LabAnalyteSummary) =>
      a.status === 'max_above_benchmark' ? 0 : a.status === 'detected' ? 1 : a.status === 'below_benchmark' ? 2 : 3;
    return rows
      .filter(g.match)
      .filter((a) => !onlyDetected || a.detects > 0)
      .filter((a) => !q.trim() || `${a.label} ${a.name}`.toLowerCase().includes(q.trim().toLowerCase()))
      .sort((a, b) => rank(a) - rank(b) || b.detects - a.detects || a.label.localeCompare(b.label));
  }, [rows, group, onlyDetected, q]);
  const detectedCount = rows.filter((a) => a.detects > 0).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-[180px] flex-1 items-center">
          <SearchIcon className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Search contaminants</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${rows.length} contaminants`}
            className="h-10 w-full rounded-full border bg-transparent pl-9 pr-3 text-sm outline-none focus-visible:border-[var(--link)] focus-visible:ring-2 focus-visible:ring-[var(--link)]/20"
          />
        </label>
        <button
          type="button"
          aria-pressed={onlyDetected}
          onClick={() => setOnlyDetected((v) => !v)}
          className={cn(
            'press h-10 rounded-full border px-4 text-sm font-medium',
            onlyDetected ? 'border-foreground bg-foreground text-background' : 'hover:bg-secondary',
          )}
        >
          Detected only · {detectedCount}
        </button>
      </div>
      <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1" role="tablist" aria-label="Contaminant groups">
        {groups.map((g) => (
          <button
            key={g.key}
            type="button"
            role="tab"
            aria-selected={group === g.key}
            onClick={() => setGroup(g.key)}
            className={cn(
              'press h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium',
              group === g.key ? 'bg-secondary text-foreground ring-1 ring-foreground/15' : 'text-muted-foreground hover:bg-secondary',
            )}
          >
            {g.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          {onlyDetected ? 'Nothing detected in this group. Turn off "Detected only" to see every test.' : 'No matches.'}
        </p>
      ) : (
        <div className="scrollbar-thin -mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Contaminant</th>
                <th className="py-2 pr-3 font-medium">Found in</th>
                <th className="py-2 pr-3 text-right font-medium">Typical</th>
                <th className="py-2 pr-3 text-right font-medium">Highest</th>
                <th className="py-2 pr-3 text-right font-medium">Limit</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => {
                const u = unit(a.benchmark?.unit ?? a.unit);
                const typ = a.medianInBenchmarkUnit ?? a.medianDetect;
                const max = a.maxInBenchmarkUnit ?? a.maxValue;
                return (
                  <tr key={`${a.dataset}-${a.name}`} className="border-b last:border-0 align-top">
                    <td className="py-2.5 pr-3">
                      <span className="block font-medium">{a.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {a.dataset === 'UCMR5' ? 'UCMR 5' : 'Six-Year Review'} · {year(a.firstDate)}–{year(a.lastDate)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">
                      {a.detects}/{a.samples}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{a.detects > 0 ? `${num(typ)} ${u}` : '–'}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{a.detects > 0 ? `${num(max)} ${u}` : '–'}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                      {a.benchmark ? `${num(a.benchmark.value)} ${unit(a.benchmark.unit)}` : 'none'}
                    </td>
                    <td className="py-2.5">
                      <Status a={a} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        "Some samples above limit" compares single samples to a federal limit; compliance is judged on averages, so it is not a violation by itself.
        Values over 20 times a limit are treated as likely unit-entry errors and left out.
      </p>
    </div>
  );
}
