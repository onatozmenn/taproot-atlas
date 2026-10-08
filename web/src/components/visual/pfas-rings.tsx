import { motion, useReducedMotion } from 'motion/react';
import type { LabAnalyteSummary, WaterSystemProfile } from '../../../../types/water-intelligence';
import { num } from '../report/format';
import { TONE, VisualFrame, useOnScreen } from './frame';

const R0 = 26; // radius of the federal-limit ring
const RMAX = 52;

function ngL(a: LabAnalyteSummary): number {
  if (a.maxInBenchmarkUnit !== undefined) return a.maxInBenchmarkUnit;
  const v = a.maxValue ?? 0;
  return a.unit === 'ug/L' ? v * 1000 : v;
}

/**
 * PFAS as a disc inside a ring. The dashed ring is the federal limit; the
 * disc is the highest sample, sized by area. A disc that spills past its
 * ring is a compound above the limit, and it keeps rippling.
 */
export function PfasRings({ p, sourceUrl }: { p: WaterSystemProfile; sourceUrl: string }) {
  const [ref, seen] = useOnScreen<HTMLDivElement>();
  const reduce = useReducedMotion();
  const rows = p.lab
    .filter((a) => a.group === 'pfas' && a.detects > 0)
    .map((a) => {
      const v = ngL(a);
      const lim = a.benchmark?.value ?? null;
      return { a, v, lim, ratio: lim ? v / lim : null };
    })
    .sort((x, y) => (y.ratio ?? -1) - (x.ratio ?? -1) || y.v - x.v)
    .slice(0, 6);
  const tested = p.lab.filter((a) => a.group === 'pfas').length;
  const above = rows.filter((r) => (r.ratio ?? 0) > 1).length;
  const window = (p.pfas.window ?? '').match(/(\d{4}).*?(\d{4})/);

  return (
    <VisualFrame
      eyebrow="PFAS · highest sample vs the 2024 federal limit"
      headline={
        rows.length === 0 ? 'None detected' : above > 0 ? `${above} above the limit` : 'None above the limit'
      }
      sub={
        rows.length === 0
          ? `${tested || 29} compounds tested across ${p.pfas.samples} rounds; none turned up.`
          : `${rows.length} of ${tested} compounds turned up. The dashed ring is the limit; a disc that spills over it is above.`
      }
      source={`EPA UCMR 5${window ? ` · ${window[1] === window[2] ? window[1] : `${window[1]}-${window[2]}`}` : ''} · measured in ng/L, parts per trillion`}
      sourceUrl={sourceUrl}
    >
      {rows.length === 0 ? (
        <div ref={ref} className="flex items-center justify-center py-6">
          <svg viewBox="-70 -70 140 140" className="size-36" aria-hidden="true">
            <circle r={R0} fill="none" stroke="var(--border)" strokeDasharray="3 4" />
            <motion.circle
              r={4}
              fill="var(--level-ok)"
              initial={reduce ? false : { scale: 0 }}
              animate={seen ? { scale: [0, 1.4, 1] } : undefined}
              transition={{ duration: 0.8 }}
            />
          </svg>
        </div>
      ) : (
        <div ref={ref} className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-3">
          {rows.map(({ a, v, lim, ratio }, i) => {
            const r = ratio === null ? 9 : Math.min(RMAX, Math.max(3, R0 * Math.sqrt(ratio)));
            const over = (ratio ?? 0) > 1;
            const c = ratio === null ? TONE.faint : over ? TONE.alert : TONE.water;
            return (
              <div key={a.name} className="flex flex-col items-center text-center">
                <svg viewBox="-60 -60 120 120" className="size-[124px] overflow-visible" role="img" aria-label={`${a.label}: ${num(v)} ng/L${lim ? ` vs ${num(lim)} ng/L limit` : ', no federal limit'}`}>
                  {over && !reduce && seen && (
                    <motion.circle
                      r={R0}
                      fill="none"
                      stroke={c}
                      strokeWidth={1}
                      initial={{ scale: 1, opacity: 0.5 }}
                      animate={{ scale: r / R0 + 0.35, opacity: 0 }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: 1 + i * 0.2 }}
                    />
                  )}
                  <motion.circle
                    r={r}
                    fill={c}
                    fillOpacity={over ? 0.85 : 0.22}
                    stroke={c}
                    strokeWidth={over ? 0 : 1.25}
                    initial={reduce ? false : { scale: 0 }}
                    animate={seen ? { scale: 1 } : undefined}
                    transition={{ type: 'spring', stiffness: 120, damping: 13, delay: 0.2 + i * 0.12 }}
                  />
                  {lim !== null && (
                    <circle r={R0} fill="none" stroke={over ? 'var(--card)' : 'var(--foreground)'} strokeOpacity={over ? 0.9 : 0.55} strokeWidth={1.25} strokeDasharray="3 3.5" />
                  )}
                </svg>
                <p className="mt-1 text-[15px] font-semibold leading-tight">{a.label.replace(/\s*\(.*\)$/, '')}</p>
                <p className="text-[13px] tabular-nums text-muted-foreground">
                  {num(v)} ng/L
                  {ratio !== null ? (
                    <span className="font-medium" style={{ color: over ? TONE.alert : undefined }}>
                      {' · '}
                      {over ? `${num(ratio)}× limit` : `${Math.round(ratio * 100)}% of limit`}
                    </span>
                  ) : (
                    ' · no limit'
                  )}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </VisualFrame>
  );
}
