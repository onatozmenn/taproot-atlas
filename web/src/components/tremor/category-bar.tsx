// Tremor CategoryBar [v0.0.3], adapted for Taproot (Apache-2.0, see LICENSE-tremor.txt).
// Changes: colours are CSS colours, optional per-segment labels instead of
// cumulative numbers, marker uses a native title instead of Tremor's Tooltip.
// Public Record: square 12px bar, no gutters, mono numbers, an ink-ruled
// legend under each segment, optional ticks for items on the scale.
import React from 'react';
import '../../styles/record-pages-tremor.css';
import { cx } from './utils';

const sum = (a: number[]) => a.reduce((s, n) => s + n, 0);
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function BarLabels({ values, suffix = '' }: { values: number[]; suffix?: string }) {
  const total = sum(values);
  let prefix = 0;
  return (
    <div className="rp-cat-nums" aria-hidden="true">
      <span style={{ left: 0 }}>0{suffix}</span>
      {values.map((v, i) => {
        prefix += v;
        const show = prefix >= 0.1 * total && total - prefix >= 0.1 * total;
        return show ? (
          <span key={i} style={{ left: `${(prefix / total) * 100}%`, transform: 'translateX(-50%)' }}>
            {fmt(prefix)}
            {suffix}
          </span>
        ) : null;
      })}
      <span style={{ right: 0 }}>
        {fmt(total)}
        {suffix}
      </span>
    </div>
  );
}

export interface CategoryBarProps extends React.HTMLAttributes<HTMLDivElement> {
  values: number[];
  /** CSS colours, one per segment. A falsy colour draws the neutral base segment. */
  colors: string[];
  marker?: { value: number; tooltip?: string; showAnimation?: boolean };
  showLabels?: boolean;
  labelSuffix?: string;
  /** Legend under each segment: name (in the segment's colour) and range. */
  legend?: Array<{ name: string; range: string; color?: string }>;
  /** Ticks under the bar for items placed on the scale (same units as values). */
  ticks?: Array<{ value: number; title?: string }>;
}

export const CategoryBar = React.forwardRef<HTMLDivElement, CategoryBarProps>(
  ({ values = [], colors, marker, showLabels = true, labelSuffix, legend, ticks, className, ...props }, ref) => {
    const max = sum(values);
    const mv = marker === undefined ? undefined : Math.min(max, Math.max(0, marker.value));
    const cols = values.map((v) => `minmax(0, ${v}fr)`).join(' ');
    return (
      <div ref={ref} className={cx(className)} {...props}>
        {showLabels ? <BarLabels values={values} suffix={labelSuffix} /> : null}
        <div className="rp-cat-bar">
          {values.map((v, i) =>
            v === 0 ? null : <span key={i} className={colors[i] ? undefined : 'base'} style={{ width: `${(v / max) * 100}%`, background: colors[i] || undefined }} />,
          )}
          {mv !== undefined ? <span className="rp-cat-mk" style={{ left: `${(mv / max) * 100}%` }} title={marker?.tooltip} /> : null}
        </div>
        {legend ? (
          <div className="rp-cat-lab" style={{ gridTemplateColumns: cols }}>
            {legend.map((l) => (
              <div key={l.name}>
                <b style={l.color ? { color: l.color } : undefined}>{l.name}</b>
                <span>{l.range}</span>
              </div>
            ))}
          </div>
        ) : null}
        {ticks && ticks.length > 0 ? (
          <div className="rp-cat-ticks" aria-hidden="true">
            {ticks.map((t, i) => (
              <i key={i} style={{ left: `${(Math.min(max, Math.max(0, t.value)) / max) * 100}%` }} title={t.title} />
            ))}
          </div>
        ) : null}
      </div>
    );
  },
);
CategoryBar.displayName = 'CategoryBar';
