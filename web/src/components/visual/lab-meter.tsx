import type { LabAnalyteSummary } from '../../../../types/water-intelligence';
import { num, unit as fmtUnit } from '../report/format';
import { VisualFrame } from './frame';
import { useBoxWidth } from '../kit/motion';

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

function niceStep(span: number): number {
  const raw = span / 5;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

/** "Total trihalomethanes (TTHM)" → code TTHM, name Total trihalomethanes. */
function names(label: string): { code: string; name: string } {
  const m = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m && m[2].length <= 8) return { code: m[2], name: m[1] };
  return { code: label, name: '' };
}

/**
 * One analyte as a register bar: ink = typical sample, dotted rule = highest
 * sample, red rule = federal limit, ▼ = half the limit. Red fill appears only
 * for the stretch where samples went over the limit.
 */
function Meter({ a, W }: { a: LabAnalyteSummary; W: number }) {
  const { u, max, med, lim } = scaled(a);
  const nd = a.detects === 0;
  const span = Math.max(lim ?? 0, max, med) * 1.12 || 1;
  const step = niceStep(span);
  const top = Math.ceil(span / step) * step;
  const X = (v: number) => (Math.min(v, top) / top) * (W - 1);
  const by = 18;
  const bh = 24;
  const over = lim !== null && max > lim;
  const { code, name } = names(a.label);
  const years = a.firstDate && a.lastDate ? `${a.firstDate.slice(0, 4)}–${a.lastDate.slice(0, 4)}` : '';
  const medLabel = `${num(med)} ${u}`;
  const inside = X(med) > medLabel.length * 7 + 16;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step / 2) ticks.push(Math.round(v * 1e6) / 1e6);
  const labelEvery = W < 420 ? 2 : 1;
  // ▼ label goes left of its mark when it would run into the limit label.
  const halfW = W < 420 ? 62 : 104;
  const halfLeft = lim !== null && (X(lim / 2) + 7 + halfW > X(lim) - 4 || X(lim) >= W - 44);
  return (
    <div className="rf-lm">
      <div className="rf-lm-h">
        <b>
          {code}
          {name && <span>{name}</span>}
        </b>
        <span className="rf-lm-lim" data-none={lim === null || undefined}>
          {lim !== null ? `limit ${num(lim)} ${u}` : 'no federal limit'}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} 70`} width={W} height={70} className="mt-1 block h-auto w-full overflow-visible" role="img" aria-label={nd ? `${a.label}: not detected in ${a.samples} samples` : `${a.label}: typical ${num(med)} ${u}, highest ${num(max)} ${u}${lim !== null ? `, limit ${num(lim)} ${u}` : ''}`}>
        <rect x={0} y={by} width={W} height={bh} fill="var(--field-2)" />
        {!nd && <rect x={0} y={by} width={Math.max(2, X(med))} height={bh} fill="var(--ink)" />}
        {over && lim !== null && <rect x={X(lim)} y={by + bh - 6} width={Math.max(2, X(max) - X(lim))} height={6} fill="var(--notice)" />}
        {!nd &&
          (inside ? (
            <text x={X(med) - 8} y={by + 16.5} textAnchor="end" className="t-paper t-b">
              {medLabel}
            </text>
          ) : (
            <text x={X(med) + 6} y={by + 16.5} className="t-ink t-b">
              {medLabel}
            </text>
          ))}
        {nd && (
          <text x={8} y={by + 16.5} className="t-ink">
            not detected in {a.samples.toLocaleString('en-US')} samples
          </text>
        )}
        {!nd && <line x1={X(max)} x2={X(max)} y1={by - 4} y2={by + bh + 4} stroke={over ? 'var(--notice)' : 'var(--ink)'} strokeWidth={1.5} strokeDasharray="2 2" />}
        {lim !== null && (
          <>
            <path d={`M${X(lim / 2)} ${by - 2}l-4 -6h8z`} fill="var(--ink)" />
            <text x={X(lim / 2) + (halfLeft ? -7 : 7)} y={by - 3} textAnchor={halfLeft ? 'end' : 'start'} className="t-ink t-b t-up">
              {W < 420 ? '½ limit' : 'Half the limit'}
            </text>
            <line x1={X(lim)} x2={X(lim)} y1={by - 8} y2={by + bh + 6} stroke="var(--notice)" strokeWidth={2} />
            {X(lim) < W - 44 ? (
              <text x={X(lim) + 6} y={over ? by - 3 : by + 16.5} className="t-red t-b">
                limit
              </text>
            ) : (
              <text x={X(lim) - 6} y={by - 3} textAnchor="end" className="t-red t-b">
                limit
              </text>
            )}
          </>
        )}
        {ticks.map((v, k) => {
          const major = k % 2 === 0;
          const x = X(v);
          const showLabel = major && (k / 2) % labelEvery === 0;
          return (
            <g key={v}>
              <line x1={x} x2={x} y1={by + bh + 2} y2={by + bh + (major ? 10 : 6)} stroke="var(--ink-3)" />
              {showLabel && (
                <text x={x} y={by + bh + 22} textAnchor={k === 0 ? 'start' : x > W - 20 ? 'end' : 'middle'}>
                  {num(v)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="rf-lm-meta">
        {nd ? (
          `${a.samples.toLocaleString('en-US')} samples${years ? ` · ${years}` : ''}`
        ) : (
          <>
            typical <b>{num(med)}</b> · highest <b>{num(max)}</b> {u} · {a.detects.toLocaleString('en-US')} of {a.samples.toLocaleString('en-US')} samples
            {years ? ` · ${years}` : ''}
          </>
        )}
      </p>
    </div>
  );
}

export function LabMeter({ name, rows, sourceUrl }: { name: string; rows: LabAnalyteSummary[]; sourceUrl: string }) {
  const [boxRef, W] = useBoxWidth<HTMLDivElement>(640, 220);
  // Analytes with a federal limit first: the figure is about the limit.
  const shown = [...rows].sort((x, y) => (y.benchmark ? 1 : 0) - (x.benchmark ? 1 : 0)).slice(0, 3);
  const head = shown.find((a) => a.detects > 0 && a.benchmark) ?? shown.find((a) => a.detects > 0) ?? shown[0];
  const s = head ? scaled(head) : null;
  const share = s && s.lim ? s.med / s.lim : null;
  const pct = share === null ? '' : share < 0.01 ? '<1' : String(Math.round(share * 100));
  const headline =
    !head || head.detects === 0
      ? 'Not detected'
      : s && s.lim && s.max > s.lim
        ? `Typical sample at ${pct}% of the limit; some samples over it`
        : share !== null
          ? `Typical sample at ${pct}% of the limit`
          : 'No federal limit for this one';
  const dataset = head?.dataset === 'UCMR5' ? 'UCMR 5' : 'SYR4 compliance samples';
  return (
    <VisualFrame
      fig={4}
      eyebrow={`${name} vs federal limit`}
      hero={head && head.detects > 0 && s ? num(s.med) : head ? '0' : '–'}
      unit={head && head.detects > 0 && s ? s.u : 'detections'}
      headline={headline}
      note={
        /byproduct|tthm|haa/i.test(name)
          ? 'Byproducts form when chlorine meets natural matter. The ▼ marks half the limit; the dotted rule is the highest sample.'
          : 'Ink is the typical sample, the dotted rule the highest. The ▼ marks half the limit.'
      }
      source={`EPA ${dataset}`}
      sourceUrl={sourceUrl}
    >
      <div ref={boxRef}>
        {shown.map((a) => (
          <Meter key={a.name} a={a} W={W} />
        ))}
      </div>
    </VisualFrame>
  );
}
