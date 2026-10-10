// Tremor BarList [v1.0.0], adapted for Taproot (Apache-2.0, see LICENSE-tremor.txt).
// Changes: per-bar CSS colour and short label for phones, `maxValue` so bars
// can be read against 100% rather than the largest row, animated width.
// Public Record: register rows (label · square bar on a field track · mono
// value) on hairlines; grey bars by default, register blue for the highlight.
import React from 'react';
import '../../styles/record-pages-tremor.css';
import { cx } from './utils';

export type Bar = {
  key?: string;
  name: string;
  /** Shorter label shown below the sm breakpoint. */
  short?: string;
  value: number;
  color?: string;
  /** Emphasised row (bold label, register-blue bar unless `color` is set). */
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
      <div ref={ref} className={cx('border-t border-rule', className)} aria-sort={sortOrder} {...props}>
        {rows.map((r) => {
          const w = r.value === 0 || max === 0 ? 0 : Math.max((r.value / max) * 100, 1);
          return (
            <div key={r.key ?? r.name} className={cx('rp-bl', r.strong && 'strong')}>
              <span className="rp-bl-n" title={r.name}>
                {r.short ? (
                  <>
                    <span className="rp-bl-short">{r.short}</span>
                    <span className="rp-bl-long">{r.name}</span>
                  </>
                ) : (
                  r.name
                )}
              </span>
              <span className="rp-bl-b" aria-hidden="true">
                <i className={showAnimation ? 'anim' : undefined} style={{ width: `${w}%`, background: r.color ?? (r.strong ? 'var(--register)' : undefined) }} />
              </span>
              <span className="rp-bl-v">{valueFormatter(r.value)}</span>
            </div>
          );
        })}
      </div>
    );
  },
);
BarList.displayName = 'BarList';
