import type { ReactNode } from 'react';
import { detectTopics } from '../../../../lib/profile-answer';
import { riskPos } from '../../../../lib/risk-text';
import type { WaterSystemProfile } from '../../../../types/water-intelligence';
import { num } from '../report/format';
import { Mark, VisualFrame } from './frame';

type MarkTone = 'flag' | 'ok' | 'elev' | 'typ';

interface Signal {
  key: string;
  label: string;
  value: string;
  unit?: string;
  /** Share of the limit, 0..n; null = no data. */
  ratio: number | null;
  state: string;
  ask: string | null;
  flag: boolean;
  mark: { tone: MarkTone; on: boolean; text: string };
  viz: ReactNode;
}

const within = { tone: 'ok' as const, on: false, text: 'Within limit' };
const flagged = { tone: 'flag' as const, on: true, text: 'Flagged' };
const noData = { tone: 'typ' as const, on: false, text: 'No record' };

/** A 0..max scale bar: ink fill to the value, red tick at the limit. */
function Gauge({ v, lim, max }: { v: number; lim: number; max: number }) {
  const W = 200;
  const x = (q: number) => 1 + (Math.min(q, max) / max) * (W - 2);
  const over = v > lim;
  return (
    <svg className="rf-sig-viz" viewBox={`0 0 ${W} 22`} preserveAspectRatio="none" width="100%" height="22" aria-hidden="true">
      <rect x="1" y="9" width={W - 2} height="4" fill="var(--field-2)" />
      <rect x="1" y="9" width={Math.max(0, x(v) - 1)} height="4" fill={over ? 'var(--notice)' : 'var(--ink)'} />
      <line x1={x(lim)} x2={x(lim)} y1="3" y2="19" stroke="var(--notice)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Squares, one per sample (or per year): filled ones need attention. */
function Squares({ cells }: { cells: Array<'none' | 'det' | 'over' | 'ctx'> }) {
  const n = cells.length;
  const step = n > 8 ? 110 / n : 13;
  const s = Math.max(5, step - 3);
  return (
    <svg className="rf-sig-viz" viewBox="0 0 112 22" width="112" height="22" aria-hidden="true">
      {cells.map((c, i) => (
        <rect
          key={i}
          x={1 + i * step}
          y={11 - s / 2}
          width={s}
          height={s}
          fill={c === 'over' ? 'var(--notice)' : c === 'det' ? 'var(--ink)' : c === 'ctx' ? 'var(--ink-3)' : 'none'}
          stroke={c === 'over' ? 'var(--notice)' : c === 'det' ? 'var(--ink)' : 'var(--ink-3)'}
          strokeWidth="1.2"
        />
      ))}
    </svg>
  );
}

/** Log ticks 0.1%..100% with an ink marker at the forecast. */
function RiskTicks({ p }: { p: number }) {
  const W = 200;
  const x = 1 + riskPos(p) * (W - 4);
  return (
    <svg className="rf-sig-viz" viewBox={`0 0 ${W} 22`} preserveAspectRatio="none" width="100%" height="22" aria-hidden="true">
      <line x1="1" y1="13" x2={W - 1} y2="13" stroke="var(--ink-3)" vectorEffect="non-scaling-stroke" />
      {Array.from({ length: 11 }, (_, i) => (
        <line key={i} x1={1 + (i * (W - 2)) / 10} x2={1 + (i * (W - 2)) / 10} y1="13" y2={i % 5 ? 17 : 19} stroke="var(--ink-3)" vectorEffect="non-scaling-stroke" />
      ))}
      <rect x={x} y="5" width="3" height="8" fill="var(--ink)" />
    </svg>
  );
}

function signals(p: WaterSystemProfile, city: string): Signal[] {
  const out: Signal[] = [];
  const l = p.leadSummary;
  const lr = l ? l.latestPpb / 15 : null;
  out.push({
    key: 'lead',
    label: 'Lead',
    value: l ? `${num(l.latestPpb)}` : '–',
    unit: l ? 'ppb' : undefined,
    ratio: lr,
    state: l ? '90th percentile · limit 15' : 'No result',
    ask: `Is there lead in ${city} water?`,
    flag: (lr ?? 0) > 1,
    mark: !l ? noData : (lr ?? 0) > 1 ? flagged : within,
    viz: l ? <Gauge v={l.latestPpb} lim={15} max={Math.max(20, l.latestPpb * 1.15)} /> : <Squares cells={[]} />,
  });

  const pfasRows = p.lab.filter((a) => a.group === 'pfas');
  const pf = pfasRows.filter((a) => a.benchmark && a.detects > 0);
  const pr = pf.length > 0 ? Math.max(...pf.map((a) => (a.maxInBenchmarkUnit ?? 0) / a.benchmark!.value)) : p.pfas.tested ? 0 : null;
  const samples = p.pfas.samples || Math.max(0, ...pfasRows.map((a) => a.samples));
  const anyDet = pfasRows.some((a) => a.detects > 0);
  const detSamples = Math.max(0, ...pfasRows.map((a) => a.detects));
  const nSq = Math.min(12, Math.max(samples, 0));
  const per = nSq > 0 ? samples / nSq : 1;
  const filled = anyDet ? Math.max(1, Math.round(detSamples / per)) : 0;
  out.push({
    key: 'pfas',
    label: 'PFAS',
    value: pr === null ? '–' : pr === 0 ? (anyDet ? 'Low' : 'None') : pr > 1 ? `${num(pr)}×` : `${Math.max(1, Math.round(pr * 100))}%`,
    ratio: pr,
    state: pr === null ? 'Not tested' : pr === 0 ? (anyDet ? `unregulated only · ${samples} samples` : `detected · ${samples} samples`) : pr > 1 ? 'the limit, highest sample' : 'of the limit, highest',
    ask: `Has ${city} reported PFAS?`,
    flag: (pr ?? 0) > 1,
    mark: pr === null ? { tone: 'typ', on: false, text: 'Not tested' } : pr > 1 ? flagged : within,
    viz: <Squares cells={Array.from({ length: nSq }, (_, i) => (i < filled ? ((pr ?? 0) > 1 ? 'over' : 'det') : 'none'))} />,
  });

  const v = p.violationSummary;
  const thisYear = new Date().getUTCFullYear();
  const yrs = Array.from({ length: 5 }, (_, i) => thisYear - 4 + i);
  const yrCell = (y: number): 'none' | 'over' | 'ctx' => {
    const inYear = p.violations.filter((x) => x.begin?.startsWith(String(y)));
    return inYear.some((x) => x.healthBased) ? 'over' : inYear.length > 0 ? 'ctx' : 'none';
  };
  out.push({
    key: 'viol',
    label: 'Violations',
    value: String(v.healthBased5Years),
    // The limit for health-based violations is zero: any one is flagged.
    ratio: v.healthBased5Years > 0 ? 1.01 : 0,
    state: 'health-based · 5 yrs',
    ask: `Any violations for ${city} in the last 5 years?`,
    flag: v.healthBased5Years > 0,
    mark: v.healthBased5Years > 0 ? flagged : v.last5Years > 0 ? { tone: 'elev', on: false, text: `${v.last5Years} other` } : within,
    viz: <Squares cells={yrs.map(yrCell)} />,
  });

  const r = p.risk;
  if (r) {
    const x = r.probability * 100;
    const val = x < 1 ? '<1' : x > 95 ? '>95' : x < 10 ? String(Math.round(x * 10) / 10) : String(Math.round(x));
    out.push({
      key: 'risk',
      label: `Risk ${r.year}`,
      value: val,
      unit: '%',
      ratio: null,
      state: 'chance of a new violation',
      ask: `What is the risk score for ${city}?`,
      flag: r.tier === 'high',
      mark: r.tier === 'high' ? flagged : r.tier === 'elevated' ? { tone: 'elev', on: true, text: 'Elevated' } : within,
      viz: <RiskTicks p={r.probability} />,
    });
  } else {
    const others = p.lab
      .filter((a) => a.group !== 'pfas' && a.benchmark && a.detects > 0 && !/^(LEAD|COPPER)/.test(a.name.toUpperCase()))
      .map((a) => ({ a, r: (a.medianInBenchmarkUnit ?? a.medianDetect ?? 0) / a.benchmark!.value }))
      .sort((x, y) => y.r - x.r);
    const top = others[0];
    const topic = top ? detectTopics(top.a.label)[0] : undefined;
    out.push({
      key: 'lab',
      label: top ? top.a.label.replace(/\s*\(.*\)$/, '') : 'Other tests',
      value: top ? `${Math.max(1, Math.round(top.r * 100))}` : '–',
      unit: top ? '%' : undefined,
      ratio: top ? top.r : null,
      state: top ? 'typical level vs limit' : 'No lab data',
      ask: top && topic ? `What about ${topic.name.toLowerCase()} in ${city}?` : `What else is tested in ${city} water?`,
      flag: (top?.r ?? 0) > 1,
      mark: !top ? noData : top.r > 1 ? flagged : within,
      viz: top ? <Gauge v={top.r} lim={1} max={Math.max(1.33, top.r * 1.15)} /> : <Squares cells={[]} />,
    });
  }
  return out;
}

const Arrow = () => (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <path d="M2 7h10M8 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="square" />
  </svg>
);

function Cell({ s, i, onAsk }: { s: Signal; i: number; onAsk?: (q: string) => void }) {
  const body = (
    <>
      <span className="rf-sig-top">
        <span>
          §{i + 1} {s.label}
        </span>
        {s.ask && onAsk ? <Arrow /> : null}
      </span>
      <span className="rf-sig-big">
        {s.value}
        {s.unit ? <small>{s.unit}</small> : null}
      </span>
      <span className="rf-sig-sub">{s.state}</span>
      {s.viz}
      <Mark tone={s.mark.tone} on={s.mark.on}>
        {s.mark.text}
      </Mark>
    </>
  );
  return s.ask && onAsk ? (
    <button
      type="button"
      onClick={() => onAsk(s.ask!)}
      className="rf-sig-c"
      data-flag={s.flag || undefined}
      aria-label={`${s.label}: ${s.value}${s.unit ? ` ${s.unit}` : ''} ${s.state}. ${s.flag ? 'Flagged. ' : ''}Ask about it`}
    >
      {body}
    </button>
  ) : (
    <div className="rf-sig-c" data-flag={s.flag || undefined}>
      {body}
    </div>
  );
}

/**
 * "Is it safe?" without pretending to know: four register cells, each a
 * check against its federal limit. ■ flagged cells carry a red rule; tapping
 * a cell asks about it, so the detail only comes when wanted.
 */
export function RecordSignals({ p, city, sourceUrl, onAsk }: { p: WaterSystemProfile; city: string; sourceUrl: string; onAsk?: (q: string) => void }) {
  const s = signals(p, city);
  const n = s.filter((x) => x.flag).length;
  const word = ['No', 'One', 'Two', 'Three', 'All four'][n];
  // Typical levels can sit under a limit while single past samples broke it;
  // the headline must not contradict an answer that mentions those samples.
  const pastPeaks = p.lab.some(
    (a) => a.benchmark && !/^(LEAD|COPPER)/.test(a.name.toUpperCase()) && (a.maxInBenchmarkUnit ?? 0) > a.benchmark.value,
  );
  const headline = n === 0 ? (pastPeaks ? 'Typical levels under every limit' : 'No check flagged') : n === 4 ? 'All four checks flagged' : `${word} of four checks flagged`;
  return (
    <figure className="viz rf rf-plain" data-fig={1}>
      <div className="rf-sig-h">
        <h3>{headline}</h3>
        <span className="rf-lbl">Fig. 1 · Record signals · {p.pwsid}</span>
      </div>
      <div className="rf-sig" role="group" aria-label={`${city}: four checks against federal limits`}>
        {s.map((x, i) => (
          <Cell key={x.key} s={x} i={i} onAsk={onAsk} />
        ))}
      </div>
      <figcaption className="rf-cap">
        <span className="rf-cap-note">
          {pastPeaks && n === 0 ? 'Some past samples ran over a limit. ' : ''}Records, not a live reading of your tap.{onAsk ? ' Tap a check to ask about it.' : ''}
        </span>
        <span className="rf-cap-r">
          <span className="rf-cap-src">SDWIS · SYR4 · UCMR 5</span>
          {sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noreferrer" className="rf-cap-link">
              EPA record
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3.5 2.5h6v6M9.5 2.5l-7 7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
              </svg>
            </a>
          )}
        </span>
      </figcaption>
    </figure>
  );
}
