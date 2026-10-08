import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import type { WaterSystemProfile } from '../../../../types/water-intelligence';
import { month, num } from '../report/format';
import { CountUp, TONE, VisualFrame, useOnScreen } from './frame';

const AL = 15;

/** A raindrop with its tip up, centred on (0,0), about 2r tall. */
const drop = (r: number) =>
  `M0 ${-r * 1.55} C ${r * 0.55} ${-r * 0.75} ${r} ${-r * 0.35} ${r} ${r * 0.2} A ${r} ${r} 0 1 1 ${-r} ${r * 0.2} C ${-r} ${-r * 0.35} ${-r * 0.55} ${-r * 0.75} 0 ${-r * 1.55} Z`;

function series(p: WaterSystemProfile) {
  const byEnd = new Map<string, { end: string; ppb: number }>();
  for (const l of p.lead) {
    const end = l.end ?? l.start;
    if (!end) continue;
    const prev = byEnd.get(end);
    if (!prev || l.ppb > prev.ppb) byEnd.set(end, { end, ppb: l.ppb });
  }
  return [...byEnd.values()].sort((a, b) => a.end.localeCompare(b.end)).slice(-18);
}

/**
 * Lead as drops hanging from the action level's waterline. Every testing
 * period is one drop on a stem; the wavy red line is the 15 ppb action
 * level, so a drop that breaks the surface is a period above it.
 */
export function LeadDrops({ p, sourceUrl }: { p: WaterSystemProfile; sourceUrl: string }) {
  const s = series(p);
  const [ref, seen] = useOnScreen<SVGSVGElement>();
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const l = p.leadSummary!;
  const W = 640;
  const H = 230;
  const padL = 8;
  const padR = 8;
  const top = 26;
  const base = H - 34;
  const ymax = Math.max(AL * 2, Math.max(...s.map((x) => x.ppb)) * 1.15);
  const y = (v: number) => base - (Math.min(v, ymax) / ymax) * (base - top);
  const step = (W - padL - padR) / Math.max(s.length, 1);
  const x = (i: number) => padL + step * (i + 0.5);
  const yAL = y(AL);
  const tone = (v: number) => (v > AL ? TONE.alert : v >= 10 ? TONE.watch : TONE.water);
  const latest = l.latestPpb;
  const wave = Array.from({ length: 40 }, (_, i) => {
    const xx = -40 + i * 25;
    return `${i === 0 ? 'M' : 'L'}${xx} ${yAL + Math.sin(i * 0.9) * 2.2}`;
  }).join(' ');
  const yearMarks = s
    .map((d, i) => ({ i, yr: d.end.slice(0, 4) }))
    .filter((d, i, arr) => i === 0 || d.yr !== arr[i - 1].yr)
    .filter((_, k, arr) => arr.length <= 7 || k % Math.ceil(arr.length / 7) === 0 || k === arr.length - 1);
  const h = hover !== null ? s[hover] : null;

  return (
    <VisualFrame
      eyebrow="Lead at the tap · 90th percentile of homes tested"
      headline={
        <>
          <CountUp value={latest} /> <span className="text-[0.6em] text-muted-foreground">ppb</span>
        </>
      }
      sub={
        latest > AL
          ? `Above the 15 ppb action level in the latest round. The utility must act to cut corrosion and replace lead lines.`
          : `${l.periodsAboveActionLevel > 0 ? `Under the line now; ${l.periodsAboveActionLevel} of ${l.periods} rounds broke it.` : `Every one of ${l.periods} rounds stayed under the line.`}`
      }
      source={`EPA SDWIS lead and copper results · ${s.length} most recent rounds`}
      sourceUrl={sourceUrl}
    >
      <div className="relative">
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label={`Lead results by testing round; latest ${num(latest)} ppb against a 15 ppb action level`}>
          <defs>
            <linearGradient id="lead-above" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--level-alert)" stopOpacity="0.07" />
              <stop offset="1" stopColor="var(--level-alert)" stopOpacity="0" />
            </linearGradient>
            <clipPath id="lead-clip">
              <rect x="0" y="0" width={W} height={H} />
            </clipPath>
          </defs>
          {/* danger zone above the waterline */}
          <rect x="0" y={top - 10} width={W} height={Math.max(0, yAL - top + 10)} fill="url(#lead-above)" />
          {/* baseline */}
          <line x1={0} x2={W} y1={base} y2={base} stroke="var(--border)" />
          {/* the waterline: action level */}
          <g clipPath="url(#lead-clip)">
            <motion.path
              d={wave}
              fill="none"
              stroke="var(--level-alert)"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              initial={reduce ? false : { x: 0 }}
              animate={reduce ? undefined : { x: [0, -(2 * Math.PI * 25) / 0.9] }}
              transition={{ duration: 6, ease: 'linear', repeat: Infinity }}
            />
          </g>
          <text x={W - padR} y={yAL - 8} textAnchor="end" className="fill-[var(--level-alert)] text-[11.5px] font-medium">
            Action level · 15 ppb
          </text>
          {s.map((d, i) => {
            const c = tone(d.ppb);
            const isLast = i === s.length - 1;
            const r = isLast ? 7.5 : 5.5;
            const cy = y(d.ppb);
            return (
              <g
                key={d.end}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                className="cursor-default outline-none"
                aria-label={`${month(d.end)}: ${num(d.ppb)} ppb`}
              >
                <rect x={x(i) - step / 2} y={top - 10} width={step} height={base - top + 10} fill="transparent" />
                <motion.line
                  x1={x(i)}
                  x2={x(i)}
                  y1={base}
                  y2={cy}
                  stroke={c}
                  strokeOpacity={hover === i ? 0.9 : 0.35}
                  strokeWidth={1.5}
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={seen ? { pathLength: 1 } : undefined}
                  transition={{ duration: 0.7, delay: 0.15 + i * 0.045, ease: [0.22, 1, 0.36, 1] }}
                />
                <motion.g
                  initial={reduce ? false : { opacity: 0, y: -18 }}
                  animate={seen ? { opacity: 1, y: 0 } : undefined}
                  transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.35 + i * 0.045 }}
                >
                  <path d={drop(hover === i ? r + 1.5 : r)} transform={`translate(${x(i)} ${cy - r * 0.2})`} fill={c} />
                </motion.g>
                {isLast && (
                  <text x={x(i)} y={cy - r * 2.1 - 4} textAnchor="middle" className="text-[12px] font-semibold" fill={c}>
                    {num(d.ppb)}
                  </text>
                )}
              </g>
            );
          })}
          {yearMarks.map(({ i, yr }) => (
            <text key={`${yr}-${i}`} x={x(i)} y={H - 12} textAnchor="middle" className="fill-[var(--tertiary)] text-[11px]">
              {yr}
            </text>
          ))}
        </svg>
        <div
          aria-live="polite"
          className="pointer-events-none absolute right-0 top-0 rounded-full bg-foreground px-3 py-1 text-[12.5px] font-medium text-background transition-opacity duration-200"
          style={{ opacity: h ? 1 : 0 }}
        >
          {h ? `${month(h.end)} · ${num(h.ppb)} ppb` : '\u00a0'}
        </div>
      </div>
    </VisualFrame>
  );
}
