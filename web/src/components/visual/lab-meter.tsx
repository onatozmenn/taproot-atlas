import { motion, useReducedMotion } from 'motion/react';
import type { LabAnalyteSummary } from '../../../../types/water-intelligence';
import { num, unit as fmtUnit } from '../report/format';
import { TONE, VisualFrame, useOnScreen } from './frame';

function scaled(a: LabAnalyteSummary) {
  let u = a.benchmark?.unit ?? a.unit ?? '';
  let max = a.maxInBenchmarkUnit ?? a.maxValue ?? 0;
  let med = a.medianInBenchmarkUnit ?? a.medianDetect ?? 0;
  let lim = a.benchmark?.value ?? null;
  if (u === 'ug/L' && lim !== null && lim >= 1000) {
    u = 'mg/L';
    max /= 1000;
    med /= 1000;
    lim /= 1000;
  }
  return { u: fmtUnit(u), max, med, lim };
}

/**
 * A test tube laid flat. The liquid is the typical level, the hollow tick
 * the highest sample, and the red cap the federal limit, so "how close to
 * the limit" reads at a glance.
 */
function Tube({ a, i, seen }: { a: LabAnalyteSummary; i: number; seen: boolean }) {
  const reduce = useReducedMotion();
  const { u, max, med, lim } = scaled(a);
  const nd = a.detects === 0;
  const span = Math.max(lim ?? 0, max) * 1.18 || 1;
  const pct = (v: number) => `${Math.min(100, (v / span) * 100)}%`;
  const over = lim !== null && max > lim;
  const c = over ? TONE.alert : lim !== null && med / lim > 0.5 ? TONE.watch : TONE.water;
  const years = a.firstDate && a.lastDate ? `${a.firstDate.slice(0, 4)}-${a.lastDate.slice(0, 4)}` : '';
  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-semibold">{a.label}</p>
        <p className="text-[13px] tabular-nums text-muted-foreground">
          {nd ? `not detected in ${a.samples.toLocaleString('en-US')} samples` : `${a.detects.toLocaleString('en-US')} of ${a.samples.toLocaleString('en-US')} samples${years ? ` · ${years}` : ''}`}
        </p>
      </div>
      <div className="relative mt-2.5 h-9">
        {/* glass */}
        <div className="absolute inset-y-1.5 left-0 right-0 overflow-hidden rounded-full border bg-[var(--muted)]">
          {!nd && (
            <motion.div
              className="tube-liquid absolute inset-y-0 left-0 rounded-full"
              style={{ background: `linear-gradient(90deg, color-mix(in oklab, ${c} 35%, transparent), ${c})` }}
              initial={reduce ? false : { width: 0 }}
              animate={seen ? { width: pct(med) } : undefined}
              transition={{ duration: 1.1, delay: 0.15 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            />
          )}
        </div>
        {over && lim !== null && (
          /* the stretch above the limit that single samples reached */
          <div
            className="absolute inset-y-1.5 rounded-r-full"
            style={{ left: pct(lim), width: `calc(${pct(max)} - ${pct(lim)})`, background: `repeating-linear-gradient(135deg, color-mix(in oklab, ${TONE.alert} 35%, transparent) 0 4px, transparent 4px 8px)` }}
            aria-hidden="true"
          />
        )}
        {!nd && (
          <motion.div
            className="absolute top-0 h-9 w-0 border-l-2 border-dotted"
            style={{ left: pct(max), borderColor: over ? TONE.alert : 'var(--foreground)' }}
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={seen ? { opacity: 0.8, y: 0 } : undefined}
            transition={{ delay: 0.9 + i * 0.12, duration: 0.4 }}
            title={`Highest ${num(max)} ${u}`}
          />
        )}
        {lim !== null && (
          <div className="absolute -top-0.5 h-10 w-[3px] rounded-full bg-[var(--level-alert)]" style={{ left: pct(lim) }} title={`Federal limit ${num(lim)} ${u}`} />
        )}
      </div>
      <div className="mt-1 flex justify-between gap-3 text-[12px] tabular-nums text-muted-foreground">
        <span>
          {nd ? '\u00a0' : (
            <>
              typical <b className="font-semibold text-foreground">{num(med)}</b> · highest <b className="font-semibold text-foreground">{num(max)}</b> {u}
            </>
          )}
        </span>
        {lim !== null && <span className="whitespace-nowrap font-medium text-[var(--level-alert)]">limit {num(lim)} {u}</span>}
      </div>
    </div>
  );
}

export function LabMeter({ name, rows, sourceUrl }: { name: string; rows: LabAnalyteSummary[]; sourceUrl: string }) {
  const [ref, seen] = useOnScreen<HTMLDivElement>();
  const shown = rows.slice(0, 3);
  const head = shown.find((a) => a.detects > 0) ?? shown[0];
  const s = head ? scaled(head) : null;
  const share = s && s.lim ? s.med / s.lim : null;
  const headline =
    !head || head.detects === 0
      ? 'Not detected'
      : s && s.lim && s.max > s.lim
        ? 'Some samples over the limit'
        : share !== null
          ? `${share < 0.01 ? '<1' : Math.round(share * 100)}% of the limit`
          : `${num(s!.med)} ${s!.u} typical`;
  return (
    <VisualFrame
      eyebrow={`${name} · typical level against the federal limit`}
      headline={headline}
      sub={head && head.detects > 0 && share !== null ? 'Typical sample, as a share of the federal limit.' : undefined}
      source={`EPA ${head?.dataset === 'UCMR5' ? 'UCMR 5' : 'Six-Year Review 4 compliance samples'}`}
      sourceUrl={sourceUrl}
    >
      <div ref={ref} className="divide-y">
        {shown.map((a, i) => (
          <Tube key={a.name} a={a} i={i} seen={seen} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-5 rounded-full" style={{ background: TONE.water }} />
          typical sample
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0 border-l-2 border-dotted border-foreground" />
          highest sample
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-[3px] rounded-full bg-[var(--level-alert)]" />
          federal limit
        </span>
      </div>
    </VisualFrame>
  );
}
