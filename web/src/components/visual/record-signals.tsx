import { motion, useReducedMotion } from 'motion/react';
import { detectTopics } from '../../../../lib/profile-answer';
import type { WaterSystemProfile } from '../../../../types/water-intelligence';
import { num } from '../report/format';
import { TONE, VisualFrame, useOnScreen } from './frame';

interface Signal {
  key: string;
  label: string;
  value: string;
  /** Share of the limit, 0..n; null = no data. */
  ratio: number | null;
  state: string;
  ask: string | null;
  tone: string;
}

function toneFor(r: number | null): string {
  if (r === null) return TONE.faint;
  return r > 1 ? TONE.alert : r >= 0.66 ? TONE.watch : TONE.ok;
}

function signals(p: WaterSystemProfile, city: string): Signal[] {
  const out: Signal[] = [];
  const l = p.leadSummary;
  const lr = l ? l.latestPpb / 15 : null;
  out.push({
    key: 'lead',
    label: 'Lead',
    value: l ? `${num(l.latestPpb)}` : '–',
    ratio: lr,
    state: l ? `ppb · limit 15` : 'No result',
    ask: `Is there lead in ${city} water?`,
    tone: toneFor(lr),
  });
  const pf = p.lab.filter((a) => a.group === 'pfas' && a.benchmark && a.detects > 0);
  const pr = pf.length > 0 ? Math.max(...pf.map((a) => (a.maxInBenchmarkUnit ?? 0) / a.benchmark!.value)) : p.pfas.tested ? 0 : null;
  out.push({
    key: 'pfas',
    label: 'PFAS',
    value: pr === null ? '–' : pr === 0 ? 'None' : pr > 1 ? `${num(pr)}×` : `${Math.round(pr * 100)}%`,
    ratio: pr,
    state: pr === null ? 'Not tested' : pr === 0 ? 'detected' : 'of the limit',
    ask: `Has ${city} reported PFAS?`,
    tone: toneFor(pr),
  });
  const v = p.violationSummary;
  out.push({
    key: 'viol',
    label: 'Violations',
    value: String(v.healthBased5Years),
    ratio: v.healthBased5Years > 0 ? Math.min(1.01, 0.4 + v.healthBased5Years * 0.2) : 0,
    state: `health-based · 5 yrs`,
    ask: `Any violations for ${city} in the last 5 years?`,
    tone: v.healthBased5Years > 0 ? TONE.alert : v.last5Years > 0 ? TONE.watch : TONE.ok,
  });
  const others = p.lab
    .filter((a) => a.group !== 'pfas' && a.benchmark && a.detects > 0 && !/^(LEAD|COPPER)/.test(a.name.toUpperCase()))
    .map((a) => ({ a, r: (a.medianInBenchmarkUnit ?? a.medianDetect ?? 0) / a.benchmark!.value }))
    .sort((x, y) => y.r - x.r);
  const top = others[0];
  const topic = top ? detectTopics(top.a.label)[0] : undefined;
  out.push({
    key: 'lab',
    label: top ? top.a.label.replace(/\s*\(.*\)$/, '') : 'Other tests',
    value: top ? `${Math.max(1, Math.round(top.r * 100))}%` : '–',
    ratio: top ? top.r : null,
    state: top ? 'typical level vs limit' : 'No lab data',
    ask: top && topic ? `What about ${topic.name.toLowerCase()} in ${city}?` : null,
    tone: toneFor(top ? top.r : null),
  });
  return out;
}

function Dial({ s, i, seen, onAsk }: { s: Signal; i: number; seen: boolean; onAsk?: (q: string) => void }) {
  const reduce = useReducedMotion();
  const R = 34;
  const C = 2 * Math.PI * R;
  const frac = s.ratio === null ? 0 : s.ratio === 0 ? 1 : Math.min(1, s.ratio);
  const over = (s.ratio ?? 0) > 1;
  const body = (
    <>
      <svg viewBox="-44 -44 88 88" className="size-[92px] -rotate-90" aria-hidden="true">
        <circle r={R} fill="none" stroke="color-mix(in oklab, var(--foreground) 12%, transparent)" strokeWidth={6} />
        {s.ratio !== null && (
          <motion.circle
            r={R}
            fill="none"
            stroke={s.tone}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={C}
            initial={reduce ? false : { strokeDashoffset: C }}
            animate={seen ? { strokeDashoffset: C * (1 - frac) } : undefined}
            transition={{ duration: 1.2, delay: 0.15 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            opacity={s.ratio === 0 ? 0.55 : 1}
          />
        )}
        {over && !reduce && seen && (
          <motion.circle
            r={R + 5}
            fill="none"
            stroke={s.tone}
            strokeWidth={1.5}
            initial={{ opacity: 0.6, scale: 0.95 }}
            animate={{ opacity: 0, scale: 1.15 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 1.4 }}
          />
        )}
      </svg>
      <span className="absolute inset-x-0 top-[30px] text-center font-display text-[24px] font-medium leading-none tabular-nums" style={{ color: over ? s.tone : undefined }}>
        {s.value}
      </span>
      <span className="mt-1 block text-[15px] font-semibold leading-tight">{s.label}</span>
      <span className="block text-[12.5px] leading-tight text-muted-foreground">{s.state}</span>
    </>
  );
  const cls = 'relative flex flex-col items-center rounded-3xl px-2 pb-3 pt-2 text-center';
  return s.ask && onAsk ? (
    <button type="button" onClick={() => onAsk(s.ask!)} className={`press ${cls} hover:bg-secondary`} aria-label={`${s.label}: ${s.value} ${s.state}. Ask about it`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * "Is it safe?" without pretending to know: four dials, each a share of
 * its federal limit. Green rings are comfortably under, red ones broke it.
 * Tapping a dial asks about it, so the detail only comes when wanted.
 */
export function RecordSignals({ p, city, sourceUrl, onAsk }: { p: WaterSystemProfile; city: string; sourceUrl: string; onAsk?: (q: string) => void }) {
  const [ref, seen] = useOnScreen<HTMLDivElement>();
  const s = signals(p, city);
  const flagged = s.filter((x) => (x.ratio ?? 0) > 1).length;
  return (
    <VisualFrame
      eyebrow={`${city} · four checks against federal limits`}
      headline={flagged === 0 ? 'Nothing over a limit' : `${flagged} of 4 over a limit`}
      sub="Records, not a live reading of your tap. Tap a dial to ask about it."
      source="EPA SDWIS, Six-Year Review 4 and UCMR 5"
      sourceUrl={sourceUrl}
    >
      <div ref={ref} className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        {s.map((x, i) => (
          <Dial key={x.key} s={x} i={i} seen={seen} onAsk={onAsk} />
        ))}
      </div>
    </VisualFrame>
  );
}
