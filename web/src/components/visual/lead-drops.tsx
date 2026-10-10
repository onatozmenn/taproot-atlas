import { useState } from 'react';
import type { WaterSystemProfile } from '../../../../types/water-intelligence';
import { num } from '../report/format';
import { VisualFrame } from './frame';
import { useBoxWidth } from '../kit/motion';

const AL = 15;
const DAY = 86_400_000;

interface Period {
  start: number;
  end: number;
  mid: number;
  ppb: number;
  label: string;
  span: boolean;
}

/** "1992 H2", "2024", "2002–04": the reporting period the way the rule names it. */
function periodLabel(s: Date, e: Date): string {
  const days = (e.getTime() - s.getTime()) / DAY;
  const y = s.getUTCFullYear();
  if (days <= 190) return `${y} H${s.getUTCMonth() < 6 ? 1 : 2}`;
  if (days <= 370) return String(y);
  return `${y}–${String(e.getUTCFullYear()).slice(2)}`;
}

function series(p: WaterSystemProfile): Period[] {
  const by = new Map<string, Period>();
  for (const l of p.lead) {
    const endIso = l.end ?? l.start;
    const startIso = l.start ?? l.end;
    if (!endIso || !startIso) continue;
    const s = new Date(`${startIso.slice(0, 10)}T00:00:00Z`);
    const e = new Date(`${endIso.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) continue;
    const k = `${startIso}|${endIso}`;
    const prev = by.get(k);
    if (prev && prev.ppb >= l.ppb) continue;
    by.set(k, {
      start: s.getTime(),
      end: e.getTime() + DAY,
      mid: (s.getTime() + e.getTime() + DAY) / 2,
      ppb: l.ppb,
      label: periodLabel(s, e),
      span: (e.getTime() - s.getTime()) / DAY > 400,
    });
  }
  return [...by.values()].sort((a, b) => a.end - b.end || a.start - b.start);
}

/** Round up to a tidy axis maximum with 4–6 gridlines. */
function niceMax(v: number): { max: number; step: number } {
  for (const step of [5, 10, 20, 50, 100]) {
    const m = Math.ceil(v / step) * step;
    if (m / step <= 6) return { max: m, step };
  }
  return { max: Math.ceil(v / 200) * 200, step: 200 };
}

/**
 * Lead at the tap as a register chart: one ink stem per reporting period,
 * multi-year periods as bars over a dotted stem, the 15 ppb action level as
 * a 1.5px ink rule. Only a period over the action level turns red.
 */
export function LeadDrops({ p, sourceUrl }: { p: WaterSystemProfile; sourceUrl: string }) {
  const s = series(p);
  const [hover, setHover] = useState<number | null>(null);
  const l = p.leadSummary!;
  const [boxRef, W] = useBoxWidth<HTMLDivElement>(640, 220);
  const narrow = W < 460;
  const H = narrow ? 232 : 262;
  const L = 26;
  const R = W - 6;
  const top = 34;
  const bot = H - 40;
  const peak = Math.max(AL, ...s.map((x) => x.ppb));
  const { max: ymax, step } = niceMax(Math.max(20, peak * 1.12));
  const Y = (v: number) => bot - (Math.min(v, ymax) / ymax) * (bot - top);
  const firstYear = s.length ? new Date(s[0].start).getUTCFullYear() : 1990;
  const y0 = Math.floor(firstYear / 5) * 5;
  const t0 = Date.UTC(y0, 0, 1);
  const t1 = Math.max(s.length ? s[s.length - 1].end : Date.now(), Date.now()) + 120 * DAY;
  const X = (t: number) => L + ((t - t0) / (t1 - t0)) * (R - L);
  const latest = s[s.length - 1];
  const latestPpb = l.latestPpb;
  const over = s.map((x, i) => ({ x, i })).filter(({ x }) => x.ppb > AL);
  const worst = over.length ? over.reduce((a, b) => (b.x.ppb > a.x.ppb ? b : a)) : null;
  const tickEvery = narrow && new Date(t1).getUTCFullYear() - y0 > 30 ? 10 : 5;
  const years: number[] = [];
  for (let y = y0; Date.UTC(y, 0, 1) <= t1; y += tickEvery) years.push(y);
  const h = hover !== null ? s[hover] : null;
  const yAL = Y(AL);

  // Latest-period label with a leader, kept clear of the action-level rule.
  let latestLabel: { x: number; y: number; px: number; py: number } | null = null;
  if (latest) {
    const px = X(latest.mid);
    const py = Y(latest.ppb) - 8;
    let ly = latest.ppb > AL ? Math.max(top - 6, py - 18) : Math.min(py - 18, yAL + 18);
    if (Math.abs(ly - yAL) < 12) ly = yAL + 18;
    if (ly > py - 6) ly = Math.max(top, py - 20);
    latestLabel = { x: Math.min(px - 26, R - 40), y: ly, px, py };
  }
  // The action-level label sits on the side away from the red over-limit label.
  const worstRight = worst ? X(worst.x.mid) < W * 0.62 : false;
  const alEnd = narrow ? worstRight || !worst : false;
  const alX = narrow ? (alEnd ? R : L + 4) : worst && worstRight && X(worst.x.mid) > L + (R - L) * 0.12 ? Math.min(R - 170, X(worst.x.mid) + 170) : L + (R - L) * 0.28;
  const tableRows = s.slice(s.length <= 24 ? 0 : -18);
  const span = s.length ? `${s[0].label.slice(0, 4)}–${latest.label}` : '';

  return (
    <VisualFrame
      fig={2}
      eyebrow="Lead, 90th percentile"
      record={p.pwsid}
      hero={num(latestPpb)}
      unit="ppb"
      headline={latestPpb > AL ? '— over the 15 ppb action level' : '— under the 15 ppb action level'}
      sub={
        latestPpb > AL
          ? 'Above the action level in the latest round. The utility must act to cut corrosion and replace lead lines.'
          : l.periodsAboveActionLevel > 0
            ? `Under the line now; ${l.periodsAboveActionLevel} of ${l.periods} rounds broke it.`
            : `Every one of ${l.periods} rounds stayed under the line.`
      }
      note="9 in 10 homes sampled were at or below this level — the measure the rule uses."
      source={`LCR ${span}`}
      sourceUrl={sourceUrl}
    >
      <div className="relative" ref={boxRef}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block h-auto w-full overflow-visible" role="img" aria-label={`Lead results by testing round; latest ${num(latestPpb)} ppb against a 15 ppb action level`}>
          {/* grid */}
          {Array.from({ length: ymax / step + 1 }, (_, k) => k * step).map((v) =>
            v === AL ? null : (
              <g key={v}>
                {v > 0 && <line x1={L} x2={R} y1={Y(v)} y2={Y(v)} stroke="var(--rule)" />}
                <text x={L - 6} y={Y(v) + 4} textAnchor="end">
                  {v}
                </text>
              </g>
            ),
          )}
          {/* the action level: 1.5px ink rule */}
          <line x1={L} x2={R} y1={yAL} y2={yAL} stroke="var(--ink)" strokeWidth={1.5} />
          <text x={L - 6} y={yAL + 4} textAnchor="end" className="t-ink t-b">
            15
          </text>
          <text x={alX} y={yAL - 6} textAnchor={alEnd ? 'end' : 'start'} className="t-ink t-b t-up t-halo">
            Action level · 15 ppb
          </text>
          {/* periods */}
          {s.map((d, i) => {
            const col = d.ppb > AL ? 'var(--notice)' : 'var(--ink)';
            const cx = X(d.mid);
            const cy = Y(d.ppb);
            const on = hover === i;
            return (
              <g
                key={`${d.start}-${d.end}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                // One tab stop for the whole chart; arrow keys walk the rounds.
                tabIndex={i === s.length - 1 ? 0 : -1}
                data-drop={i}
                onKeyDown={(e) => {
                  const to = e.key === 'ArrowLeft' ? i - 1 : e.key === 'ArrowRight' ? i + 1 : -1;
                  if (to < 0 || to >= s.length) return;
                  e.preventDefault();
                  (e.currentTarget.parentElement?.querySelector(`[data-drop="${to}"]`) as SVGGElement | null)?.focus();
                }}
                className="cursor-default outline-none"
                aria-label={`${d.label}: ${num(d.ppb)} ppb`}
              >
                <rect x={cx - 6} y={top - 10} width={12} height={bot - top + 10} fill="transparent" />
                {d.span ? (
                  <>
                    <rect x={X(d.start) + 1} y={cy - 1.25} width={Math.max(2, X(d.end) - X(d.start) - 2)} height={2.5} fill={col} />
                    <line x1={cx} x2={cx} y1={cy} y2={bot} stroke={col} strokeDasharray="1 2" />
                  </>
                ) : (
                  <>
                    <line x1={cx} x2={cx} y1={cy} y2={bot} stroke={col} strokeWidth={1.5} />
                    <path d={`M${cx} ${cy - 6.5}c2.2 2.8 3.4 4.4 3.4 6.2a3.4 3.4 0 0 1-6.8 0c0-1.8 1.2-3.4 3.4-6.2z`} fill={col} />
                  </>
                )}
                {on && <rect x={cx - 6} y={cy - 10} width={12} height={bot - cy + 10} fill="none" stroke="var(--register)" strokeWidth={1.5} />}
              </g>
            );
          })}
          {/* baseline + time axis */}
          <line x1={L} x2={R} y1={bot} y2={bot} stroke="var(--ink)" />
          {years.map((yr) => (
            <g key={yr}>
              <line x1={X(Date.UTC(yr, 0, 1))} x2={X(Date.UTC(yr, 0, 1))} y1={bot} y2={bot + 5} stroke="var(--ink)" />
              <text x={X(Date.UTC(yr, 0, 1))} y={bot + 18} textAnchor="middle">
                {yr}
              </text>
            </g>
          ))}
          {/* direct labels */}
          {worst && (() => {
            const wx = X(worst.x.mid);
            const right = wx < W * 0.62;
            const tx = right ? wx + 8 : wx - 8;
            const anchor = right ? 'start' : 'end';
            const ty = Y(worst.x.ppb) + 2;
            return (
              <g pointerEvents="none">
                <text x={tx} y={ty} textAnchor={anchor} className="t-red t-b t-halo">
                  {num(worst.x.ppb)} ppb · {worst.x.label}
                </text>
                {!narrow && (
                  <text x={tx} y={ty + 13} textAnchor={anchor} className="t-red t-halo">
                    over the action level
                  </text>
                )}
              </g>
            );
          })()}
          {latestLabel && latest && worst?.i !== s.length - 1 && (
            <g pointerEvents="none">
              <path d={`M${latestLabel.x + 4} ${latestLabel.y - 4}H${latestLabel.px}V${latestLabel.py - 2}`} fill="none" stroke="var(--ink)" />
              <text x={latestLabel.x} y={latestLabel.y} textAnchor="end" className="t-ink t-b t-halo">
                {num(latest.ppb)} ppb · {latest.label}
              </text>
            </g>
          )}
          <text x={L} y={H - 4} className="t-up">
            {narrow ? 'ppb · one mark per period' : 'ppb · one mark per reporting period · bars span multi-year periods'}
          </text>
        </svg>
        <div aria-live="polite" className="rf-tag" style={{ opacity: h ? 1 : 0, left: `${hover === null ? 50 : Math.min(84, Math.max(16, (X(s[hover].mid) / W) * 100))}%` }}>
          {h ? `${h.label} · ${num(h.ppb)} ppb` : '\u00a0'}
        </div>
      </div>
      <span className="rf-lbl rf-ltab-h">Table 2 · 90th percentile, ppb, by reporting period</span>
      <div className="rf-ltab">
        {tableRows.map((d) => (
          <div key={`${d.start}-${d.end}`} className="rf-lt" data-over={d.ppb > AL || undefined}>
            <span>{d.label}</span>
            <b>{num(d.ppb)}</b>
          </div>
        ))}
      </div>
    </VisualFrame>
  );
}
