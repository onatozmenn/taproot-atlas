// Tremor BarList [v1.0.0], adapted for Taproot (Apache-2.0, see LICENSE-tremor.txt).
// Changes: per-bar CSS colour and short label for phones, `maxValue` so bars
// can be read against 100% rather than the largest row, animated width.
import React from 'react';
import { cx } from './utils';

export type Bar = {
  key?: string;
  name: string;
  /** Shorter label shown below the sm breakpoint. */
  short?: string;
  value: number;
  color?: string;
  /** Emphasised row (bold label and value). */
  strong?: boolean;
};

export interface BarListProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Bar[];
  valueFormatter?: (value: number) => string;
  showAnimation?: boolean;
  sortOrder?: 'ascending' | 'descending' | 'none';
  /** Scale bars against this value instead of the largest row. */
  maxValue?: number;
}

export const BarList = React.forwardRef<HTMLDivElement, BarListProps>(
  ({ data = [], valueFormatter = (v) => String(v), showAnimation = false, sortOrder = 'descending', maxValue, className, ...props }, ref) => {
    const rows = React.useMemo(
      () => (sortOrder === 'none' ? data : [...data].sort((a, b) => (sortOrder === 'ascending' ? a.value - b.value : b.value - a.value))),
      [data, sortOrder],
    );
    const max = maxValue ?? Math.max(...rows.map((r) => r.value), 0);
    return (
      <div ref={ref} className={cx('flex justify-between gap-4', className)} aria-sort={sortOrder} {...props}>
        <div className="relative w-full space-y-1.5">
          {rows.map((r) => {
            const w = r.value === 0 || max === 0 ? 0 : Math.max((r.value / max) * 100, 2);
            return (
              <div key={r.key ?? r.name} className="relative flex h-8 items-center rounded-md">
                <div
                  className={cx('absolute inset-y-0 left-0 rounded-md', showAnimation && 'transition-[width] duration-500 ease-out')}
                  style={{ width: `${w}%`, background: `color-mix(in oklab, ${r.color ?? 'var(--link)'} ${r.strong ? 26 : 16}%, transparent)` }}
                />
                <div
                  className={cx('absolute inset-y-0 left-0 w-[3px] rounded-l-md', showAnimation && 'transition-opacity duration-500')}
                  style={{ background: r.color ?? 'var(--link)', opacity: w > 0 ? 1 : 0 }}
                />
                <p className={cx('relative truncate pl-3 pr-2 text-[13.5px]', r.strong ? 'font-semibold text-foreground' : 'text-muted-foreground')} title={r.name}>
                  {r.short ? (
                    <>
                      <span className="sm:hidden">{r.short}</span>
                      <span className="hidden sm:inline">{r.name}</span>
                    </>
                  ) : (
                    r.name
                  )}
                </p>
              </div>
            );
          })}
        </div>
        <div className="shrink-0">
          {rows.map((r, i) => (
            <div key={r.key ?? r.name} className={cx('flex h-8 items-center justify-end', i < rows.length - 1 && 'mb-1.5')}>
              <p className={cx('whitespace-nowrap text-[13.5px] tabular-nums', r.strong ? 'font-semibold' : 'text-muted-foreground')}>{valueFormatter(r.value)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  },
);
BarList.displayName = 'BarList';
