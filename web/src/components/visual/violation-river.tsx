import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { plainViolation, type ViolationKind } from '../../../../lib/plain-violation';
import type { ProfileViolation, WaterSystemProfile } from '../../../../types/water-intelligence';
import { day } from '../report/format';
import { TONE, VisualFrame, useOnScreen } from './frame';
import { useBoxWidth } from '../kit/motion';

const YEARS = 10;

const KIND: Record<ViolationKind, { label: string; lane: number; color: string }> = {
  limit: { label: 'Above a limit', lane: 0, color: TONE.alert },
  treatment: { label: 'Treatment fell short', lane: 1, color: TONE.watch },
  testing: { label: 'Missed a test', lane: 2, color: 'var(--chart-1)' },
  notice: { label: 'Late notice or report', lane: 3, color: TONE.faint },
};

function Mark({ kind, r, color, open }: { kind: ViolationKind; r: number; color: string; open: boolean }) {
  if (kind === 'limit') return <circle r={r + 1.5} fill={color} />;
  if (kind === 'treatment') return <rect x={-r} y={-r} width={r * 2} height={r * 2} transform="rotate(45)" rx={1.5} fill={color} />;
  if (kind === 'testing') return <circle r={r} fill="var(--card)" stroke={color} strokeWidth={1.75} />;
  return <rect x={-r * 0.8} y={-1.5} width={r * 1.6} height={3} rx={1.5} fill={color} opacity={open ? 1 : 0.9} />;
}

/**
 * Ten years of records as stones in a river. The current runs left to right
 * through time; each violation sits in it by start date, in a lane by what
 * kind of lapse it was. Red stones are water above a limit; hollow rings
 * are missed tests. A stone still open keeps pulsing. Tap one to read it.
 */
export function ViolationRiver({
  p,
  sourceUrl,
  filter,
  topicName,
}: {
  p: WaterSystemProfile;
  sourceUrl: string;
  filter?: (v: ProfileViolation) => boolean;
  topicName?: string;
}) {
  const [ref, seen] = useOnScreen<SVGSVGElement>();
  const reduce = useReducedMotion();
  const [sel, setSel] = useState<string | null>(null);
  const now = new Date();
  const startYear = now.getUTCFullYear() - YEARS + 1;
  const t0 = Date.UTC(startYear, 0, 1);
  const t1 = now.getTime();
  const all = (filter ? p.violations.filter(filter) : p.violations).filter((v) => v.begin);
  const inWin = all.filter((v) => Date.parse(v.begin!) >= t0);
  const older = all.length - inWin.length;
  const items = useMemo(
    () =>
      inWin.map((v, k) => {
        const pv = plainViolation(v);
        const open = !v.returnedToCompliance && !/resolved|archived/i.test(v.status ?? '');
        return { v, pv, open, k };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.pwsid, filter],
  );
  const [boxRef, W] = useBoxWidth<HTMLDivElement>(640);
  const H = W < 420 ? 210 : 200;
  const riverTop = 34;
  const riverBot = 160;
  const laneY = (lane: number) => riverTop + 18 + lane * ((riverBot - riverTop - 36) / 3);
  const x = (iso: string) => 14 + ((Date.parse(iso) - t0) / (t1 - t0)) * (W - 28);
  // Same-lane stones that land on top of each other fan out vertically.
  const placed = useMemo(() => {
    const out: Array<(typeof items)[number] & { cx: number; cy: number }> = [];
    for (const it of [...items].sort((a, b) => (a.v.begin! < b.v.begin! ? -1 : 1))) {
      const lane = KIND[it.pv.kind].lane;
      let cx = x(it.v.begin!);
      let cy = laneY(lane);
      let n = 0;
      // Phones squeeze ten years into ~300 px, so stones may fan further.
      const maxFan = W < 420 ? 8 : 6;
      while (out.some((o) => Math.abs(o.cx - cx) < 7 && Math.abs(o.cy - cy) < 7) && n < maxFan) {
        n++;
        cy = laneY(lane) + (n % 2 ? -1 : 1) * Math.ceil(n / 2) * 6;
      }
      if (n === maxFan) cx += 3.5; // still crowded: nudge sideways so it shows as a cluster, not one stone
      out.push({ ...it, cx, cy });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, W]);

  const counts = (Object.keys(KIND) as ViolationKind[]).map((k) => ({ k, n: items.filter((i) => i.pv.kind === k).length }));
  const health = items.filter((i) => i.v.healthBased).length;
  const openN = items.filter((i) => i.open).length;
  const chosen = placed.find((i) => i.v.id + i.k === sel) ?? null;
  const fiveAgo = `${now.getUTCFullYear() - 5}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const last5 = items.filter((i) => i.v.begin! >= fiveAgo);

  // Two drifting sine banks make the river. One wavelength is 2π/0.55
  // steps of 20 px; the drawing is wide enough to slide by exactly one.
  const WAVE = (2 * Math.PI * 20) / 0.55;
  const pts = (y0: number, amp: number, ph: number) =>
    Array.from({ length: 56 }, (_, i) => [-40 + i * 20, y0 + Math.sin(i * 0.55 + ph) * amp] as const);
  const bank = (y0: number, amp: number, ph: number) => pts(y0, amp, ph).map(([xx, yy], i) => `${i === 0 ? 'M' : 'L'}${xx} ${yy.toFixed(1)}`).join(' ');
  const riverPath = `${bank(riverTop, 4, 0)} ${[...pts(riverBot, 4, 1.4)].reverse().map(([xx, yy]) => `L${xx} ${yy.toFixed(1)}`).join(' ')} Z`;

  const headline =
    items.length === 0
      ? `No ${topicName ? `${topicName.toLowerCase()} ` : ''}violations in ${YEARS} years`
      : health > 0
        ? `${health} health-based in ${YEARS} years`
        : `${items.length} record${items.length === 1 ? '' : 's'}, none health-based`;

  return (
    <VisualFrame
      eyebrow={`${topicName ? `${topicName} · ` : ''}EPA violations, ${startYear} to today`}
      headline={headline}
      sub={
        items.length === 0
          ? older > 0
            ? `${older} older record${older === 1 ? '' : 's'} before ${startYear}; the river has run clear since.`
            : 'The river has run clear.'
          : `${last5.length} in the last 5 years${openN > 0 ? `, ${openN} still open` : ''}. Tap a stone to read it.`
      }
      source={`EPA SDWIS via ECHO${older > 0 && items.length > 0 ? ` · ${older} older record${older === 1 ? '' : 's'} not drawn` : ''}`}
      sourceUrl={sourceUrl}
    >
      <div ref={boxRef}>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label={`${items.length} violations since ${startYear}, ${health} health-based`}>
        <defs>
          <linearGradient id="river" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--link)" stopOpacity="0.04" />
            <stop offset="1" stopColor="var(--link)" stopOpacity="0.13" />
          </linearGradient>
          <clipPath id="river-clip">
            <rect x="0" y="0" width={W} height={H} />
          </clipPath>
        </defs>
        <g clipPath="url(#river-clip)">
          <motion.path
            d={riverPath}
            fill="url(#river)"
            initial={reduce ? false : { x: 0 }}
            animate={reduce ? undefined : { x: [0, -WAVE] }}
            transition={{ duration: 6, ease: 'linear', repeat: Infinity }}
          />
          {/* current lines */}
          {[0.33, 0.66].map((f, i) => (
            <motion.path
              key={f}
              d={bank(riverTop + (riverBot - riverTop) * f, 2.5, i)}
              fill="none"
              stroke="var(--link)"
              strokeOpacity={0.14}
              strokeDasharray="14 22"
              initial={reduce ? false : { strokeDashoffset: 0 }}
              animate={reduce ? undefined : { strokeDashoffset: [0, -72] }}
              transition={{ duration: 4 + i, ease: 'linear', repeat: Infinity }}
            />
          ))}
        </g>
        {/* year ticks */}
        {Array.from({ length: YEARS }, (_, i) => startYear + i).map((yr) => {
          const xx = x(`${yr}-01-01`);
          return (
            <g key={yr}>
              <line x1={xx} x2={xx} y1={riverBot + 6} y2={riverBot + 11} stroke="var(--border)" />
              {(yr - startYear) % (W < 420 ? 3 : 2) === 0 ? (
                <text x={xx} y={H - 12} textAnchor="start" className="fill-[var(--tertiary)] text-[11px]">
                  {yr}
                </text>
              ) : null}
            </g>
          );
        })}
        {items.length === 0 && (
          <text x={W / 2} y={(riverTop + riverBot) / 2 + 4} textAnchor="middle" className="fill-[var(--level-ok)] text-[13px] font-medium">
            Clear water · no records
          </text>
        )}
        {placed.map((it, idx) => {
          const meta = KIND[it.pv.kind];
          const key = it.v.id + it.k;
          const active = sel === key;
          const r = it.pv.kind === 'limit' ? 5 : 4;
          return (
            <motion.g
              key={key}
              style={{ x: it.cx, y: it.cy }}
              initial={reduce ? false : { opacity: 0, scale: 0 }}
              animate={seen ? { opacity: 1, scale: active ? 1.6 : 1 } : undefined}
              transition={{ type: 'spring', stiffness: 300, damping: 18, delay: active ? 0 : 0.2 + (it.cx / W) * 1.1 + (idx % 3) * 0.02 }}
              className="cursor-pointer outline-none focus-visible:[&>circle:first-child]:stroke-[var(--link)] focus-visible:[&>circle:first-child]:[stroke-width:2]"
              tabIndex={0}
              role="button"
              aria-label={`${it.pv.title}, ${day(it.v.begin)}`}
              onClick={() => setSel(active ? null : key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSel(active ? null : key);
                }
              }}
            >
              <circle r={10} fill="transparent" />
              {active && <circle r={r + 4.5} fill="none" stroke="var(--foreground)" strokeWidth={1.25} />}
              {it.open && !reduce && (
                <motion.circle
                  r={r + 2}
                  fill="none"
                  stroke={meta.color}
                  initial={{ scale: 1, opacity: 0.7 }}
                  animate={{ scale: 2.6, opacity: 0 }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              <Mark kind={it.pv.kind} r={r} color={meta.color} open={it.open} />
            </motion.g>
          );
        })}
      </svg>
      </div>

      <AnimatePresence mode="wait">
        {chosen ? (
          <motion.div
            key={chosen.v.id + chosen.k}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            className="mt-2 rounded-2xl bg-[var(--muted)] px-4 py-3"
          >
            <p className="flex items-center gap-2 text-[15px] font-semibold">
              <span className="size-2 shrink-0 rounded-full" style={{ background: KIND[chosen.pv.kind].color }} />
              {chosen.pv.title}
            </p>
            <p className="mt-0.5 text-[13.5px] text-muted-foreground">
              {day(chosen.v.begin)}
              {chosen.v.returnedToCompliance ? ` · fixed ${day(chosen.v.returnedToCompliance)}` : chosen.open ? ' · still open' : ' · resolved'}
              {chosen.v.healthBased ? ' · health-based' : ''}
              {chosen.v.contaminant ? ` · ${chosen.v.contaminant.toLowerCase()}` : ''}
            </p>
          </motion.div>
        ) : (
          <motion.ul
            key="legend"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground"
          >
            {counts.filter(({ n }) => n > 0).map(({ k, n }) => (
              <li key={k} className="flex items-center gap-1.5">
                <svg viewBox="-7 -7 14 14" className="size-3.5" aria-hidden="true">
                  <Mark kind={k} r={4} color={KIND[k].color} open={false} />
                </svg>
                {KIND[k].label}
                <b className="font-semibold tabular-nums text-foreground">{n}</b>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </VisualFrame>
  );
}
