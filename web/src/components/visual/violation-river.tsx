import { useMemo, useState } from 'react';
import { plainViolation, type ViolationKind } from '../../../../lib/plain-violation';
import type { ProfileViolation, WaterSystemProfile } from '../../../../types/water-intelligence';
import { day } from '../report/format';
import { Mark, TONE, VisualFrame } from './frame';
import { useBoxWidth } from '../kit/motion';
import { Tracker, type TrackerBlockProps } from '../tremor';

const YEARS = 10;
const RIVER_YEARS = 5;
const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Severity of a year's records, for the ten-year Tracker. */
export type YearSeverity = 'hb' | 'mt' | 'other';

/**
 * One Tremor Tracker block per calendar year, by its most serious record:
 * ■ red = health-based, ochre outline = a missed test or other lapse,
 * □ = nothing on record.
 */
export function yearBlocks(byYear: Map<number, YearSeverity[]>, startYear: number, years = YEARS): TrackerBlockProps[] {
  return Array.from({ length: years }, (_, i) => {
    const y = startYear + i;
    const ks = byYear.get(y) ?? [];
    const hb = ks.filter((k) => k === 'hb').length;
    const mt = ks.filter((k) => k === 'mt').length;
    const other = ks.filter((k) => k === 'other').length;
    const parts = [hb ? `${hb} health-based` : '', mt ? `${mt} missed test${mt === 1 ? '' : 's'}` : '', other ? `${other} other` : ''].filter(Boolean);
    return {
      key: y,
      color: hb ? TONE.alert : undefined,
      outline: !hb && ks.length > 0 ? true : undefined,
      tooltip: `${y}: ${parts.length ? parts.join(', ') : 'no violations'}`,
    };
  });
}

const sev = (v: ProfileViolation, kind: ViolationKind): YearSeverity => (v.healthBased ? 'hb' : kind === 'testing' ? 'mt' : 'other');

const shortDay = (t: number) => {
  const d = new Date(t);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};

/**
 * The record as a river: five years run left to right on a grey band, each
 * violation sits on it as a span from start to fix. Health-based spans are
 * red; other lapses are ochre ticks. A blue rule marks today. Below, a
 * ten-year Tracker gives each year's worst record. Tap a span to read it.
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
  const [sel, setSel] = useState<string | null>(null);
  const now = new Date();
  const nowT = now.getTime();
  const startYear = now.getUTCFullYear() - YEARS + 1;
  const riverStart = now.getUTCFullYear() - RIVER_YEARS;
  const t0 = Date.UTC(riverStart, 0, 1);
  const t1 = Date.UTC(now.getUTCFullYear() + 1, 0, 1);
  const tenStart = Date.UTC(startYear, 0, 1);
  const all = (filter ? p.violations.filter(filter) : p.violations).filter((v) => v.begin);
  const items = useMemo(
    () =>
      all
        .filter((v) => Date.parse(v.begin!) >= tenStart)
        .map((v, k) => {
          const pv = plainViolation(v);
          const open = !v.returnedToCompliance && !/resolved|archived/i.test(v.status ?? '');
          const b = Date.parse(v.begin!);
          const fixIso = v.returnedToCompliance ?? v.end;
          const e = open ? nowT : fixIso ? Date.parse(fixIso) + DAY : b + 30 * DAY;
          return { v, pv, open, k, b, e, key: `${v.id}${k}` };
        })
        .sort((a, b) => a.b - b.b),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.pwsid, filter],
  );
  const older = all.length - items.length;
  const river = items.filter((i) => i.e >= t0);
  const fiveAgo = nowT - 5 * 365.25 * DAY;
  const last5 = items.filter((i) => i.b >= fiveAgo);
  const health5 = last5.filter((i) => i.v.healthBased);
  const open5 = last5.filter((i) => i.open).length;

  const [boxRef, W] = useBoxWidth<HTMLDivElement>(640, 220);
  const narrow = W < 460;
  const noteH = narrow ? 70 : 58;
  const ry = noteH + 26;
  const H = ry + 34;
  const X = (t: number) => Math.min(W, Math.max(0, ((t - t0) / (t1 - t0)) * W));

  const blocks = useMemo(() => {
    const m = new Map<number, YearSeverity[]>();
    for (const it of items) {
      const y = new Date(it.b).getUTCFullYear();
      m.set(y, [...(m.get(y) ?? []), sev(it.v, it.pv.kind)]);
    }
    return yearBlocks(m, startYear);
  }, [items, startYear]);

  // The span the note talks about: the one tapped, else the latest health-based, else the latest.
  const chosen = items.find((i) => i.key === sel) ?? null;
  const featured = [...river].reverse().find((i) => i.v.healthBased) ?? river[river.length - 1] ?? null;
  const note = featured;
  const nx = note ? X(note.b) : 0;
  const side: 'start' | 'end' = nx > W * 0.55 ? 'end' : 'start';
  const days = (i: (typeof items)[number]) => Math.max(1, Math.round((i.e - i.b) / DAY));
  const fixWord = (i: (typeof items)[number]) => {
    const d = days(i);
    return d <= 45 ? 'fixed in a month' : d <= 100 ? `fixed in ${Math.round(d / 30)} months` : d < 365 ? `fixed in ${Math.round(d / 30)} months` : `fixed after ${Math.round(d / 365)} year${Math.round(d / 365) === 1 ? '' : 's'}`;
  };

  const topic = topicName ? `${topicName.toLowerCase()} ` : '';
  const hero = health5.length > 0 ? health5.length : last5.length;
  const headline =
    last5.length === 0
      ? `${topic}violations in five years${older + items.length > 0 ? `; ${items.length + older} on record before` : ''}`
      : health5.length > 0
        ? `health-based ${topic}violation${health5.length === 1 ? '' : 's'} in five years${health5.length === 1 && !health5[0].open ? ` — ${fixWord(health5[0])}` : open5 > 0 ? ` — ${open5} still open` : ''}`
        : `${topic}record${last5.length === 1 ? '' : 's'} in five years, none health-based`;

  const tone = (i: (typeof items)[number]) => (i.v.healthBased ? 'var(--notice)' : i.pv.kind === 'testing' ? 'var(--ochre)' : 'var(--ink-3)');

  return (
    <VisualFrame
      fig={5}
      eyebrow={`${topicName ? `${topicName} · ` : ''}Violations, ${riverStart} → today`}
      record={p.pwsid}
      hero={hero}
      headline={headline}
      note="One span per violation, from start to fix. One square per year below; colour shows the most serious record that year."
      source={`SDWIS via ECHO${older > 0 ? ` · ${older} before ${startYear}` : ''}`}
      sourceUrl={sourceUrl}
    >
      <div className="rf-vr" ref={boxRef}>
        {note && (
          <div
            className="rf-vr-note"
            data-side={side}
            style={side === 'end' ? { right: W - nx + 6, maxWidth: nx - 6 } : { left: nx + 6, maxWidth: W - nx - 6 }}
            aria-hidden="true"
          >
            <span className="d" data-tone={note.v.healthBased ? undefined : note.pv.kind === 'testing' ? 'elev' : 'ink'}>
              {shortDay(note.b)} → {note.open ? 'still open' : `fixed ${shortDay(note.e - DAY)}`}, {new Date(note.b).getUTCFullYear()}
            </span>
            <span className="t">{note.pv.title}</span>
            <span className="m">
              {note.v.healthBased ? 'health-based' : note.pv.kind === 'testing' ? 'missed test' : 'record'} · {days(note)} days{note.open ? ' so far' : ' open'}
            </span>
          </div>
        )}
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block h-auto w-full overflow-visible" role="img" aria-label={`${items.length} violations since ${startYear}, ${health5.length} health-based in five years`}>
          <rect x={0} y={ry - 7} width={W} height={14} fill="var(--field-2)" />
          {Array.from({ length: RIVER_YEARS + 2 }, (_, k) => riverStart + k).map((yr) => {
            const x = X(Date.UTC(yr, 0, 1));
            const show = yr <= now.getUTCFullYear() && (!narrow || (yr - riverStart) % 1 === 0);
            return (
              <g key={yr}>
                <line x1={x} x2={x} y1={ry + 7} y2={ry + 15} stroke="var(--ink)" />
                {show && x < W - 24 && (
                  <text x={x + 4} y={ry + 28} className={note && new Date(note.b).getUTCFullYear() === yr ? 't-ink t-b' : undefined}>
                    {narrow ? `’${String(yr).slice(2)}` : yr}
                  </text>
                )}
              </g>
            );
          })}
          {note && <line x1={nx} x2={nx} y1={4} y2={ry - 12} stroke={tone(note)} />}
          {items.length === 0 && (
            <text x={W / 2} y={ry - 16} textAnchor="middle" className="t-ink t-up">
              No records in {RIVER_YEARS} years
            </text>
          )}
          {/* today */}
          <rect x={X(nowT) - 1} y={ry - 12} width={2} height={24} fill="var(--register)" />
          <text x={X(nowT) - 5} y={ry - 17} textAnchor="end" className="t-blue t-b t-up">
            Today
          </text>
          {river.map((it) => {
            const x0 = X(it.b);
            const x1 = Math.max(x0 + 4, X(it.e));
            const hb = it.v.healthBased;
            const active = sel === it.key;
            return (
              <g
                key={it.key}
                className="cursor-pointer outline-none"
                tabIndex={0}
                role="button"
                aria-label={`${it.pv.title}, ${day(it.v.begin)}`}
                aria-pressed={active}
                onClick={() => setSel(active ? null : it.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSel(active ? null : it.key);
                  }
                }}
              >
                <rect x={Math.min(x0, x1 - 22) - 6} y={ry - 22} width={Math.max(x1 - x0, 22) + 12} height={44} fill="transparent" />
                {hb ? (
                  <rect x={x0} y={ry - 12} width={x1 - x0} height={24} fill="var(--notice)" />
                ) : (
                  <rect x={x0} y={ry - 7} width={x1 - x0} height={14} fill={it.pv.kind === 'testing' ? 'var(--ochre-tint)' : 'var(--field)'} stroke={tone(it)} strokeWidth={1.5} />
                )}
                {active && <rect x={x0 - 3} y={ry - 15} width={x1 - x0 + 6} height={30} fill="none" stroke="var(--ink)" strokeWidth={1.5} />}
              </g>
            );
          })}
        </svg>

        {chosen && (
          <div className="rf-vr-sel" data-hb={chosen.v.healthBased || undefined} aria-live="polite">
            <p className="t">{chosen.pv.title}</p>
            <p className="m">
              {day(chosen.v.begin)}
              {chosen.v.returnedToCompliance ? ` · fixed ${day(chosen.v.returnedToCompliance)}` : chosen.open ? ' · still open' : ' · resolved'}
              {chosen.v.healthBased ? ' · health-based' : ''}
              {chosen.v.contaminant ? ` · ${chosen.v.contaminant.toLowerCase()}` : ''}
            </p>
          </div>
        )}

        <div className="rf-vr-yr">
          <span className="rf-lbl">
            Worst record each year · {startYear}–{startYear + YEARS - 1}
          </span>
          <div className="rf-vr-key" aria-hidden="true">
            <Mark tone="flag" on>
              Health-based
            </Mark>
            <Mark tone="elev" on>
              Missed test / other
            </Mark>
            <Mark tone="typ">None</Mark>
          </div>
          <Tracker data={blocks} defaultBackgroundColor="" className="h-7" hoverEffect aria-label="Each year's most serious record; tap a year for counts" />
          <div className="rf-trk-yrs" aria-hidden="true">
            {blocks.map((b, i) => (
              <span key={String(b.key)} data-hb={b.color ? 'true' : undefined}>
                {W < 420 ? `’${String(startYear + i).slice(2)}` : startYear + i}
              </span>
            ))}
          </div>
        </div>
      </div>
    </VisualFrame>
  );
}
