// Tremor SparkBarChart / SparkAreaChart [v1.0.0], adapted for Taproot
// (Apache-2.0, see LICENSE-tremor.txt). Changes: CSS-colour per category,
// optional per-bar colour (`colorKey`), no animation by default so long
// lists stay cheap. Uses Recharts, so import it only from lazy routes.
import React from 'react';
import { Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { cx } from './utils';

type Datum = Record<string, string | number | null>;

interface SparkProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Datum[];
  categories: string[];
  index: string;
  /** CSS colours, one per category. */
  colors?: string[];
  maxValue?: number;
}

export const SparkBarChart = React.forwardRef<HTMLDivElement, SparkProps & { colorKey?: string; type?: 'default' | 'stacked' }>(
  ({ data = [], categories = [], index, colors = ['var(--link)'], maxValue, colorKey, type = 'default', className, ...other }, ref) => (
    <div ref={ref} className={cx('h-12 w-28', className)} {...other}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ bottom: 0, left: 0, right: 0, top: 0 }} barCategoryGap="14%">
          <XAxis hide dataKey={index} />
          <YAxis hide domain={[0, maxValue ?? 'auto']} />
          {categories.map((c, i) => (
            <Bar key={c} dataKey={c} stackId={type === 'stacked' ? 'stack' : undefined} fill={colors[i] ?? colors[0]} isAnimationActive={false} radius={1}>
              {colorKey ? data.map((d, j) => <Cell key={j} fill={(d[colorKey] as string) ?? colors[i]} />) : null}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  ),
);
SparkBarChart.displayName = 'SparkBarChart';

export const SparkAreaChart = React.forwardRef<HTMLDivElement, SparkProps>(({ data = [], categories = [], index, colors = ['var(--link)'], maxValue, className, ...other }, ref) => {
  const id = React.useId().replace(/:/g, '');
  return (
    <div ref={ref} className={cx('h-12 w-28', className)} {...other}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ bottom: 1, left: 1, right: 1, top: 1 }}>
          <XAxis hide dataKey={index} />
          <YAxis hide domain={[0, maxValue ?? 'auto']} />
          {categories.map((c, i) => (
            <React.Fragment key={c}>
              <defs>
                <linearGradient id={`${id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors[i] ?? colors[0]} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={colors[i] ?? colors[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="linear" dataKey={c} stroke={colors[i] ?? colors[0]} strokeWidth={1.75} fill={`url(#${id}-${i})`} dot={false} isAnimationActive={false} />
            </React.Fragment>
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});
SparkAreaChart.displayName = 'SparkAreaChart';
