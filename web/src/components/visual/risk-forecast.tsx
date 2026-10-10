import { motion, useReducedMotion } from 'motion/react';
import type { RiskScore, WaterSystemProfile } from '../../../../types/water-intelligence';
import { RISK_BINS, driverText, riskPos } from '../../../../lib/risk-text';
import { CountUp, TONE, VisualFrame, useOnScreen } from './frame';

const W = 320;
const H = 64;
const TICKS: Array<[number, string]> = [
  [0.001, '0.1%'],
  [0.01, '1%'],
  [0.1, '10%'],
  [1, '100%'],
];

function tone(r: RiskScore): string {
  return r.tier === 'high' ? TONE.alert : r.tier === 'elevated' ? TONE.watch : r.tier === 'low' ? TONE.ok : TONE.water;
}

function pctLabel(p: number): { value: number; decimals: number; prefix: string } {
  const x = p * 100;
  if (x < 1) return { value: 1, decimals: 0, prefix: '<' };
  if (x > 95) return { value: 95, decimals: 0, prefix: '>' };
  return { value: x < 10 ? Math.round(x * 10) / 10 : Math.round(x), decimals: x < 10 ? 1 : 0, prefix: '' };
}

/**
 * The forecast as a place in the crowd: every scored U.S. system is a sliver
 * of the ridge (log scale), this system is the dropped pin, and the factors
 * that moved its forecast push left (lower) or right (higher) from a centre line.
 */
export function RiskForecast({ p, sourceUrl }: { p: WaterSystemProfile; sourceUrl: string }) {
  const r = p.risk;
  const [ref, seen] = useOnScreen<HTMLDivElement>();
  const reduce = useReducedMotion();
  if (!r) return null;
  const c = tone(r);
  const dist = r.distribution ?? [];
  const peak = Math.max(1, ...dist);
  const x = riskPos(r.probability) * W;
  const baseX = riskPos(r.baseRate) * W;
  const lab = pctLabel(r.probability);
  const maxW = Math.max(0.6, ...r.drivers.map((d) => Math.abs(d.w)));
  const rank =
    r.percentile >= 0.5 ? `Higher than ${Math.round(r.percentile * 100)}% of U.S. systems Taproot scores.` : `Lower than ${Math.round((1 - r.percentile) * 100)}% of U.S. systems Taproot scores.`;

  return (
    <VisualFrame
      eyebrow={`Forecast · chance of a new health-based violation in ${r.year}`}
      headline={
        <span style={{ color: c }}>
          {lab.prefix}
          <CountUp value={lab.value} decimals={lab.decimals} />%
        </span>
      }
      sub={`${rank} The U.S. average is ${Math.round(r.baseRate * 1000) / 10}%.`}
      source={`Taproot model on EPA SDWIS records · backtest ${r.backtest.years}: top 10% caught ${Math.round(r.backtest.modelRecallTop10 * 100)}% of next-year violations (EPA targeting score: ${Math.round(r.backtest.ettRecallTop10 * 100)}%)`}
      sourceUrl={sourceUrl}
    >
      <div ref={ref}>
        <svg viewBox={`0 -14 ${W} ${H + 50}`} className="w-full overflow-visible" role="img" aria-label={`Forecast ${lab.prefix}${lab.value}% against all scored systems`}>
          {dist.map((n, i) => {
            const h = Math.max(1, (n / peak) * (H - 6));
            const bx = (i / RISK_BINS) * W;
            return (
              <motion.rect
                key={i}
                x={bx + 0.6}
                width={W / RISK_BINS - 1.2}
                y={H - h}
                height={h}
                rx={1.5}
                fill="var(--tertiary)"
                fillOpacity={0.35}
                initial={reduce ? false : { scaleY: 0 }}
                animate={seen ? { scaleY: 1 } : undefined}
                style={{ transformOrigin: `0px ${H}px` }}
                transition={{ duration: 0.6, delay: i * 0.015, ease: [0.22, 1, 0.36, 1] }}
              />
            );
          })}
          <line x1={0} x2={W} y1={H} y2={H} stroke="var(--border)" />
          {TICKS.map(([v, t]) => (
            <text key={t} x={riskPos(v) * W} y={H + 16} textAnchor={v === 1 ? 'end' : v === 0.001 ? 'start' : 'middle'} className="fill-muted-foreground text-[11px]">
              {t}
            </text>
          ))}
          <line x1={baseX} x2={baseX} y1={4} y2={H} stroke="var(--foreground)" strokeOpacity={0.45} strokeDasharray="2 3" />
          <text x={baseX} y={H + 31} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            U.S. average
          </text>
          <motion.g initial={reduce ? false : { y: -18, opacity: 0 }} animate={seen ? { y: 0, opacity: 1 } : undefined} transition={{ type: 'spring', stiffness: 160, damping: 14, delay: 0.55 }}>
            <line x1={x} x2={x} y1={-4} y2={H} stroke={c} strokeWidth={2} />
            <circle cx={x} cy={-6} r={5} fill={c} />
          </motion.g>
        </svg>

        {r.drivers.length > 0 && (
          <div className="mt-4 space-y-2.5 pb-2">
            <p className="flex justify-between text-[12.5px] font-medium text-muted-foreground"><span>Lowers it</span><span>What moved it</span><span>Raises it</span></p>
            {r.drivers.slice(0, 4).map((d, i) => {
              const up = d.dir === 'up';
              const wPct = (Math.abs(d.w) / maxW) * 50;
              return (
                <div key={d.f}>
                  <p className="text-[14px] leading-snug">
                    <span className="font-medium" style={{ color: up ? TONE.alert : TONE.ok }}>
                      {up ? '↑ ' : '↓ '}
                    </span>
                    {driverText(d)}
                  </p>
                  <div className="relative mt-1.5 h-1.5 rounded-full bg-muted">
                    <span className="absolute inset-y-[-3px] left-1/2 w-px bg-border" />
                    <motion.span
                      className="absolute inset-y-0 rounded-full"
                      style={{ background: up ? TONE.alert : TONE.ok, [up ? 'left' : 'right']: '50%' }}
                      initial={reduce ? false : { width: 0 }}
                      animate={seen ? { width: `${wPct}%` } : undefined}
                      transition={{ duration: 0.7, delay: 0.8 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </VisualFrame>
  );
}
