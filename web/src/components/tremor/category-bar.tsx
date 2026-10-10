// Tremor CategoryBar [v0.0.3], adapted for Taproot (Apache-2.0, see LICENSE-tremor.txt).
// Changes: colours are CSS colours, optional per-segment labels instead of
// cumulative numbers, marker uses a native title instead of Tremor's Tooltip.
import React from 'react';
import { cx } from './utils';

const sum = (a: number[]) => a.reduce((s, n) => s + n, 0);
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function BarLabels({ values, suffix = '' }: { values: number[]; suffix?: string }) {
  const total = sum(values);
  let prefix = 0;
  return (
    <div className="relative mb-1.5 flex h-4 w-full text-[11.5px] font-medium tabular-nums text-muted-foreground">
      <div className="absolute bottom-0 left-0">0{suffix}</div>
      {values.map((v, i) => {
        prefix += v;
        const show = prefix >= 0.1 * total && prefix < 0.9 * total && total - prefix >= 0.1 * total;
        return (
          <div key={i} className="flex items-center justify-end" style={{ width: `${(v / total) * 100}%` }}>
            {show ? <span className="block translate-x-1/2">{fmt(prefix)}{suffix}</span> : null}
          </div>
        );
      })}
      <div className="absolute bottom-0 right-0">{fmt(total)}{suffix}</div>
    </div>
  );
}

export interface CategoryBarProps extends React.HTMLAttributes<HTMLDivElement> {
  values: number[];
  /** CSS colours, one per segment. */
  colors: string[];
  marker?: { value: number; tooltip?: string; showAnimation?: boolean };
  showLabels?: boolean;
  labelSuffix?: string;
}

export const CategoryBar = React.forwardRef<HTMLDivElement, CategoryBarProps>(
  ({ values = [], colors, marker, showLabels = true, labelSuffix, className, ...props }, ref) => {
    const max = sum(values);
    const mv = marker === undefined ? undefined : Math.min(max, Math.max(0, marker.value));
    const markerColor = React.useMemo(() => {
      if (mv === undefined) return undefined;
      let s = 0;
      for (let i = 0; i < values.length; i++) {
        s += values[i];
        if (s >= mv && values[i] > 0) return colors[i];
      }
      return colors[values.length - 1];
    }, [mv, values, colors]);
    return (
      <div ref={ref} className={cx(className)} {...props}>
        {showLabels ? <BarLabels values={values} suffix={labelSuffix} /> : null}
        <div className="relative flex h-2 w-full items-center">
          <div className="flex h-full flex-1 items-center gap-0.5 overflow-hidden rounded-full">
            {values.map((v, i) => (
              <div key={i} className={cx('h-full', v === 0 && 'hidden')} style={{ width: `${(v / max) * 100}%`, background: colors[i] ?? 'var(--tertiary)' }} />
            ))}
          </div>
          {mv !== undefined ? (
            <div
              className={cx('absolute w-2 -translate-x-1/2', marker?.showAnimation && 'transform-gpu transition-all duration-300 ease-in-out')}
              style={{ left: `${(mv / max) * 100}%` }}
              title={marker?.tooltip}
            >
              <div className="mx-auto h-4 w-1 rounded-full ring-2 ring-background" style={{ background: markerColor }} />
            </div>
          ) : null}
        </div>
      </div>
    );
  },
);
CategoryBar.displayName = 'CategoryBar';
