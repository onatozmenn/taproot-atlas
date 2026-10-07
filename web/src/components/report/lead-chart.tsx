import { useMemo, useState } from 'react';
import type { WaterSystemProfile } from '../../../../types/water-intelligence';
import { month, num } from './format';

/**
 * Lead 90th-percentile history as a step-free line chart with the 15 ppb
 * action level drawn across. Pure SVG (no chart lib): scales to the card,
 * keyboard/hover reveals each period.
 */
export function LeadChart({ series, actionLevel = 15, unitLabel = 'ppb', label = 'Lead, 90th percentile' }: {
  series: WaterSystemProfile['lead'];
  actionLevel?: number;
  unitLabel?: string;
  label?: string;
}) {
  const pts = useMemo(() => {
    const byEnd = new Map<string, { end: string; ppb: number }>();
    for (const s of series) if (s.end) byEnd.set(s.end, { end: s.end, ppb: s.ppb });
    return [...byEnd.values()].sort((a, b) => (a.end < b.end ? -1 : 1));
  }, [series]);
  const [hover, setHover] = useState<number | null>(null);
  if (pts.length === 0) return null;

  const W = 640;
  const H = 220;
  const pad = { l: 40, r: 16, t: 16, b: 28 };
  const maxY = Math.max(actionLevel * 1.25, ...pts.map((p) => p.ppb)) * 1.05;
  const t0 = Date.parse(pts[0].end);
  const t1 = Date.parse(pts[pts.length - 1].end);
  const span = Math.max(t1 - t0, 1);
  const x = (end: string) => (pts.length === 1 ? (W - pad.l - pad.r) / 2 + pad.l : pad.l + ((Date.parse(end) - t0) / span) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / maxY) * (H - pad.t - pad.b);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.end).toFixed(1)},${y(p.ppb).toFixed(1)}`).join(' ');
  const area = `${d} L${x(pts[pts.length - 1].end).toFixed(1)},${y(0)} L${x(pts[0].end).toFixed(1)},${y(0)} Z`;
  const ticks = [0, actionLevel / 3, (2 * actionLevel) / 3, actionLevel].map((v) => Math.round(v));
  const years = [...new Set(pts.map((p) => p.end.slice(0, 4)))];
  const step = Math.max(1, Math.ceil(years.length / 6));
  const shownYears = years.filter((_, i) => i % step === 0);
  const h = hover !== null ? pts[hover] : pts[pts.length - 1];

  return (
    <figure className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <figcaption className="text-sm font-medium">{label}</figcaption>
        <p className="text-sm tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">{num(h.ppb)} {unitLabel}</span> · {month(h.end)}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={`${label} from ${month(pts[0].end)} to ${month(pts[pts.length - 1].end)}; action level ${actionLevel} ${unitLabel}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          let best = 0;
          pts.forEach((p, i) => {
            if (Math.abs(x(p.end) - px) < Math.abs(x(pts[best].end) - px)) best = i;
          });
          setHover(best);
        }}
      >
        <defs>
          <linearGradient id="leadFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-2)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
              {t}
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(actionLevel)} y2={y(actionLevel)} stroke="var(--level-alert)" strokeDasharray="6 5" strokeWidth={1.5} />
        <text x={W - pad.r} y={y(actionLevel) - 6} textAnchor="end" className="fill-[var(--level-alert)] text-[11px] font-medium">
          Action level {actionLevel} {unitLabel}
        </text>
        <path d={area} fill="url(#leadFill)" />
        <path d={d} fill="none" stroke="var(--chart-2)" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <circle
            key={p.end}
            cx={x(p.end)}
            cy={y(p.ppb)}
            r={hover === i ? 5 : 3}
            fill={p.ppb > actionLevel ? 'var(--level-alert)' : 'var(--background)'}
            stroke={p.ppb > actionLevel ? 'var(--level-alert)' : 'var(--chart-2)'}
            strokeWidth={2}
          />
        ))}
        {shownYears.map((yr) => {
          const first = pts.find((p) => p.end.startsWith(yr));
          return first ? (
            <text key={yr} x={x(first.end)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular-nums">
              {yr}
            </text>
          ) : null;
        })}
      </svg>
    </figure>
  );
}
