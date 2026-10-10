import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { driverText } from '../../../../lib/risk-text';
import type { RiskDriver } from '../../../../types/water-intelligence';
import { TONE } from '../visual/frame';
import { BarList, Callout, CategoryBar, Slider, Tracker, type TrackerBlockProps } from '../tremor';
import { ExtLink, IcoAlert, IcoAsk, IcoDown, IcoInfo, IcoRetry, Masthead, RecordHeader } from './record-page';

/* Taproot Triage — the regulator / utility view of the forecast.
   Route: /#/triage?state=OH. One question: where should the next visit go? */

type Action = 'monitoring' | 'lead' | 'dbp' | 'micro' | 'chem' | 'deficiency' | 'surface' | 'enforcement' | 'watch';

export interface TriageRow {
  id: string;
  n: string;
  st: string;
  c: string;
  pop: number;
  p: number;
  pct: number;
  ett: number;
  hb5: number;
  mr1: number;
  open: number;
  svi: number | null;
  src: 'S' | 'G';
  a: Action;
  d: string[];
  dv: Array<number | null>;
  dd: Array<'up' | 'down'>;
  dl: string[];
  hy?: number[];
  my?: number[];
}

export interface TriageData {
  meta: {
    year: number;
    base_rate: number;
    actions: Record<Action, string>;
    curve: { share_visited: number[]; model: number[]; ett: number[]; repeat: number[]; years: string };
    fairness: Array<{ svi: string; base_rate: number; recall_top10: number; flag_rate: number; systems: number }>;
    svi_source: string;
    ett_note: string;
    history_years?: number[];
  };
  state: string | null;
  stateName: string | null;
  matched: number;
  inScope: number;
  expected: number;
  summary: { flagged: number; flaggedPeople: number; notOnEttList: number; vulnerable: number };
  rows: TriageRow[];
}

const STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico',
};

const ACTION_SHORT: Record<Action, string> = {
  monitoring: 'Missed tests',
  lead: 'Lead',
  dbp: 'Byproducts',
  micro: 'Bacteria',
  chem: 'Chemicals',
  deficiency: 'Deficiencies',
  surface: 'Surface water',
  enforcement: 'Open violations',
  watch: 'Watch',
};

const VULNERABLE = 0.75;

export function parseTriageHash(hash: string): { state: string | null } {
  const q = hash.split('?')[1] ?? '';
  const st = new URLSearchParams(q).get('state')?.toUpperCase() ?? null;
  return { state: st && STATES[st] ? st : null };
}

/** Linear interpolation on the backtest capacity curve. */
export function caught(curve: number[], xs: number[], share: number): number {
  if (share <= 0) return 0;
  if (share <= xs[0]) return (curve[0] * share) / xs[0];
  for (let i = 1; i < xs.length; i++) {
    if (share <= xs[i]) {
      const t = (share - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return curve[i - 1] + t * (curve[i] - curve[i - 1]);
    }
  }
  return curve[curve.length - 1];
}

function nice(name: string): string {
  const cased =
    name === name.toUpperCase()
      ? name
          .toLowerCase()
          .replace(/\b[a-z]/g, (c) => c.toUpperCase())
          .replace(/\b(Of|And|The)\b/g, (w) => w.toLowerCase())
      : name;
  // Data arrives both ALL CAPS and title-cased ("Tri County Sud"); acronyms stay caps either way.
  return cased
    .replace(/\b(Sud|Mud|Wsc|Pws|Wsd|Psd|Ynp|Gtnp|Rwd|Cwd|Wd|Pud|Hoa|Mhp|Usa|Ii|Iii|Llc|Afb)\b/g, (w) => w.toUpperCase())
    .replace(/\s*-\s*/g, ' - ');
}

const pctText = (p: number) => (p >= 0.995 ? '>99%' : p < 0.01 ? '<1%' : `${Math.round(p * 100)}%`);
export const people = (n: number) =>
  n >= 1_000_000 ? `${Math.round(n / 100_000) / 10}M` : n >= 1_000 ? `${n >= 10_000 ? Math.round(n / 1000) : Math.round(n / 100) / 10}k` : String(n);
export const ordinal = (n: number) => {
  const t = n % 100;
  return `${n}${t >= 11 && t <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

/** Three tiers so colour carries meaning down the queue: red (health-based
    risk is high), ochre (elevated), ink (typical). */
export const RISK_TIERS = [
  { min: 0.5, label: '50% or more', name: 'High', word: 'high', cls: 'h', color: TONE.alert },
  { min: 0.15, label: '15–50%', name: 'Elevated', word: 'elevated', cls: 'e', color: TONE.watch },
  { min: 0, label: 'under 15%', name: 'Typical', word: 'typical', cls: '', color: TONE.faint },
] as const;
const tierOf = (p: number) => RISK_TIERS.find((t) => p >= t.min) ?? RISK_TIERS[2];
export const riskTone = (p: number) => (RISK_TIERS.find((t) => p >= t.min) ?? RISK_TIERS[2]).color;

function drivers(r: TriageRow): RiskDriver[] {
  return r.d.map((f, i) => ({ f, label: r.dl[i] ?? f, value: r.dv[i] ?? null, dir: r.dd[i] ?? 'up', w: 0 }));
}

async function fetchTriage(params: Record<string, string>): Promise<TriageData> {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== ''));
  let res: Response;
  try {
    res = await fetch(`/api/triage?${qs.toString()}`);
  } catch {
    // Cold starts occasionally drop the first request: try once more.
    await new Promise((r) => setTimeout(r, 600));
    res = await fetch(`/api/triage?${qs.toString()}`);
  }
  if (!res.ok) throw new Error(`Triage request failed (${res.status})`);
  return (await res.json()) as TriageData;
}

/** "If you can reach N systems, how much of next year's trouble do you meet?" */
function Capacity({ data }: { data: TriageData }) {
  const scope = data.inScope;
  const maxN = Math.max(1, Math.round(scope * 0.3));
  const [n, setN] = useState(() => Math.max(1, Math.round(scope * 0.05)));
  useEffect(() => setN(Math.max(1, Math.round(scope * 0.05))), [scope]);
  const c = data.meta.curve;
  const share = n / scope;
  const pct = Math.round(share * 1000) / 10;
  const model = caught(c.model, c.share_visited, share);
  const ett = caught(c.ett, c.share_visited, share);
  const repeat = caught(c.repeat, c.share_visited, share);
  const ticks = [1, Math.round(scope * 0.05), Math.round(scope * 0.1), Math.round(scope * 0.2), maxN].filter((t, i, a) => t >= 1 && t <= maxN && a.indexOf(t) === i);
  return (
    <section aria-label="Capacity planner">
      <div className="rp-plan-h">
        <b>Inspect {pct}% of systems</b>
        <span className="rp-lbl">
          ≈ {n.toLocaleString('en-US')} of {scope.toLocaleString('en-US')} visits
        </span>
      </div>
      <Slider
        className="mt-1"
        min={1}
        max={maxN}
        step={1}
        value={[n]}
        ticks={ticks}
        onValueChange={(v) => setN(v[0] ?? 1)}
        aria-label="Systems your team can reach"
        ariaLabelThumb="Systems your team can reach"
      />
      <div className="rp-slab" aria-hidden="true">
        <span>0%</span>
        <span>10%</span>
        <span>20%</span>
        <span>30%</span>
      </div>
      <p className="rp-lbl" style={{ margin: '22px 0 6px' }}>
        Next-year violators reached
      </p>
      <BarList
        sortOrder="none"
        maxValue={1}
        showAnimation
        valueFormatter={(v) => `${Math.round(v * 100)}%`}
        data={[
          { key: 'model', name: 'Taproot forecast', short: 'Taproot', value: model, strong: true },
          { key: 'repeat', name: 'Last year’s violators', short: 'Repeat last year', value: repeat },
          { key: 'ett', name: 'EPA targeting formula', short: 'EPA ETT', value: ett },
        ]}
      />
      <p className="mt-3 text-[14px] leading-snug">
        Taking them in Taproot’s order meets about <strong>{Math.round(model * 100)}%</strong> of next year’s new health-based violations
        {data.expected >= 5 ? (
          <> (≈{Math.round(model * data.expected)} of {Math.round(data.expected)} expected)</>
        ) : data.expected > 0 ? (
          <> (only about {Math.max(1, Math.round(data.expected))} expected here a year, so read this as the national rate)</>
        ) : null}
        .
      </p>
      <p className="rp-note mt-2">
        One backtest ({c.years}, all U.S. systems Taproot scores), read at the share of systems you can reach: each method visits its own top {pct}%.
      </p>
    </section>
  );
}

/** Ten calendar years of health-based violations as Tracker cells (count inside, □ when clean). */
export function historyBlocks(r: Pick<TriageRow, 'hy' | 'my'>, years: number[]): TrackerBlockProps[] {
  if (!r.hy || !r.my) return [];
  return years.map((y, i) => {
    const hb = r.hy![i] ?? 0;
    const mr = r.my![i] ?? 0;
    const parts = [hb ? `${hb} health-based` : '', mr ? `${mr} missed-test or reporting` : ''].filter(Boolean);
    return {
      key: y,
      color: hb ? TONE.alert : undefined,
      label: hb ? String(hb) : undefined,
      tooltip: `${y}: ${parts.length ? `${parts.join(', ')} violation${hb + mr === 1 ? '' : 's'}` : 'no violations recorded'}`,
    };
  });
}

/** Health-based violations a year as square columns with real-pixel counts. */
function YearColumns({ values, years }: { values: number[]; years: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div>
      <div className="rp-spark" aria-hidden="true">
        {values.map((v, i) => (
          <div key={years[i] ?? i}>
            {v > 0 && <b>{v}</b>}
            <i style={{ height: `${(v / max) * 72}px` }} />
          </div>
        ))}
      </div>
      <div className="rp-spark-yr" aria-hidden="true">
        <span>{years[0]}</span>
        <span>{years[years.length - 1]}</span>
      </div>
    </div>
  );
}

function Row({ r, rank, actions, year, years }: { r: TriageRow; rank: number; actions: Record<Action, string>; year: number; years: number[] }) {
  const [open, setOpen] = useState(false);
  const blocks = useMemo(() => historyBlocks(r, years), [r, years]);
  const hbTotal = r.hy ? r.hy.reduce((a, b) => a + b, 0) : 0;
  const tier = tierOf(r.p);
  const misses = r.ett < 11 && r.p >= 0.05;
  const ask = `What's the risk of a new violation at ${nice(r.n)} next year?`;
  const detailId = `tri-${r.id}`;
  return (
    <li className={cn('rp-qli', open && 'open')}>
      <div className="rp-qrow">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={open ? detailId : undefined} className="rp-qbtn rp-qcols">
          <span className="rk">
            {String(rank).padStart(2, '0')}
            <IcoDown className="rp-ico" />
          </span>
          <span className="nm">
            <b>{nice(r.n)}</b>
            <span>
              {r.id}
              {r.c ? ` · ${r.c}, ${r.st}` : ` · ${r.st}`}
            </span>
            {(r.svi ?? 0) >= VULNERABLE && (
              <span className="rp-qtags">
                <span className="rp-mark typ" data-on="true">
                  High vulnerability
                </span>
              </span>
            )}
          </span>
          <span className="ppl">
            {r.pop.toLocaleString('en-US')} people<span>{r.src === 'S' ? 'surface water' : 'groundwater'}</span>
          </span>
          <span className={cn('risk', tier.cls)}>
            <b>{pctText(r.p)}</b>
            <span>{tier.word}</span>
          </span>
          <span className={cn('ett', misses && r.ett === 0 && 'z')} title={misses ? 'EPA’s targeting formula would not flag this system yet (score under 11)' : undefined}>
            <span className="m">EPA ETT</span>
            {r.ett}
          </span>
          <span className="step">
            <span>Suggested first step</span>
            {actions[r.a]}
          </span>
        </button>
        <div className="act">
          <a href={`#/ask?q=${encodeURIComponent(ask)}&pwsid=${encodeURIComponent(r.id)}`} className={cn('rp-btn', open ? 'primary' : '')} aria-label={`Ask Taproot about ${nice(r.n)}`}>
            <IcoAsk />
            Ask Taproot
          </a>
        </div>
      </div>
      {open && (
        <div className="rp-qdetail" id={detailId}>
          <div>
            <h5>Why it’s flagged</h5>
            <ul>
              {drivers(r).map((d) => (
                <li key={d.f} className="rp-drv">
                  <span>{driverText(d)}</span>
                  <b className={d.dir === 'up' ? undefined : 'dn'} aria-label={d.dir === 'up' ? 'raises risk' : 'lowers risk'}>
                    {d.dir === 'up' ? '↑' : '↓'}
                  </b>
                </li>
              ))}
            </ul>
          </div>
          {blocks.length > 0 && (
            <div>
              <h5>
                10-year tracker · {years[0]}–{years[years.length - 1]}
              </h5>
              <div className="rp-trkrow">
                <span>Health</span>
                <Tracker data={blocks} defaultBackgroundColor="" className="h-7" hoverEffect aria-label="Health-based violations by year; tap a year" />
              </div>
              <div className="rp-trkrow" aria-hidden="true">
                <span>Missed</span>
                <div className="rp-trk h-7">
                  {years.map((y, i) => {
                    const m = r.my?.[i] ?? 0;
                    return (
                      <span key={y} className="rp-trk-b" style={{ cursor: 'default' }}>
                        <span data-empty={m ? undefined : true} data-outline={m ? true : undefined}>
                          {m || ''}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="rp-trkyr">
                <span>{years[0]}</span>
                <span>{years[years.length - 1]}</span>
              </div>
            </div>
          )}
          {r.hy && hbTotal > 0 && (
            <div>
              <h5>Health-based violations by year</h5>
              <YearColumns values={r.hy} years={years} />
            </div>
          )}
          <div className="rp-qmeta">
            <p>
              {Math.round(r.p * 1000) / 10}% chance of a new health-based violation in {year} · EPA targeting score {r.ett}
              {r.svi !== null ? ` · county vulnerability ${ordinal(Math.round(r.svi * 100))} percentile` : ''} · {r.id}
            </p>
            <ExtLink href={`https://echo.epa.gov/detailed-facility-report?fid=${encodeURIComponent(r.id)}`}>EPA record</ExtLink>
          </div>
        </div>
      )}
    </li>
  );
}

export function TriageView({ initialState = null }: { initialState?: string | null }) {
  const [state, setState] = useState<string | null>(initialState);
  const [action, setAction] = useState<Action | ''>('');
  const [hidden, setHidden] = useState(false);
  const [vulnerable, setVulnerable] = useState(false);
  const [limit, setLimit] = useState(25);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<TriageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onHash = () => {
      const st = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('state')?.toUpperCase() ?? null;
      if (window.location.hash.startsWith('#/triage')) setState(st && STATES[st] ? st : null);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.title = `Taproot Triage${state ? ` · ${STATES[state]}` : ''}`;
    const h = `#/triage${state ? `?state=${state}` : ''}`;
    if (window.location.hash !== h) window.history.replaceState(null, '', h);
  }, [state]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchTriage({ state: state ?? '', action, hidden: hidden ? '1' : '', vulnerable: vulnerable ? '1' : '', limit: String(limit) })
      .then((d) => {
        if (!live) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'Could not load the queue.'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [state, action, hidden, vulnerable, limit, reload]);

  const where = state ? STATES[state] : 'the U.S.';
  const year = data?.meta.year ?? 2026;
  const fair = useMemo(() => {
    const f = data?.meta.fairness ?? [];
    return { high: f.find((x) => x.svi === 'high'), low: f.find((x) => x.svi === 'low') };
  }, [data]);
  const rows = data?.rows ?? [];
  const top = rows[0];
  const low = rows.length > 1 ? rows[rows.length - 1] : undefined;

  return (
    <div className="rp">
      <RecordHeader page="Triage queue" />

      <main className="rp-main">
        <Masthead
          kicker={['Regulator view', state ? `${STATES[state]} · ${state}` : 'All states']}
          title={
            <>
              {state ? STATES[state] : 'U.S.'} triage queue <em>· {year} forecast</em>
            </>
          }
          dek={
            <>
              Every community water system serving 3,300+ people, ranked by Taproot’s forecast of a new health-based violation in {year}. A priority list for inspections, help and
              funding, not a verdict on anyone’s water.
            </>
          }
          meta={[
            { k: 'For', v: 'State programs · utilities · TA teams' },
            { k: 'Scope', v: data ? `${data.inScope.toLocaleString('en-US')} systems` : '—' },
            { k: 'Forecast', v: `${year} · health-based` },
            { k: 'Backtest', v: data?.meta.curve.years ?? '—' },
          ]}
        />

        <div className="flex flex-col gap-2.5">
          <div className="rp-filters">
            <label className="sr-only" htmlFor="triage-state">
              State
            </label>
            <select
              id="triage-state"
              value={state ?? ''}
              onChange={(e) => {
                setState(e.target.value || null);
                setLimit(25);
              }}
              className="rp-select"
            >
              <option value="">All states</option>
              {Object.entries(STATES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button type="button" className="rp-tog" aria-pressed={hidden} onClick={() => setHidden((h) => !h)}>
              EPA formula misses it
            </button>
            <button type="button" className="rp-tog" aria-pressed={vulnerable} onClick={() => setVulnerable((v) => !v)}>
              High social vulnerability
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="rp-lbl hidden shrink-0 sm:inline">First step</span>
            <div className="rp-chiprow min-w-0" role="group" aria-label="Suggested first step">
              <button type="button" className="rp-tog" aria-pressed={action === ''} onClick={() => setAction('')}>
                Any issue
              </button>
              {(['monitoring', 'lead', 'dbp', 'micro', 'chem', 'deficiency', 'surface', 'enforcement', 'watch'] as Action[]).map((a) => (
                <button key={a} type="button" className="rp-tog" aria-pressed={action === a} onClick={() => setAction(action === a ? '' : a)}>
                  {ACTION_SHORT[a]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <Callout
            variant="error"
            icon={IcoAlert}
            title="The queue didn’t load"
            action={
              <button type="button" className="rp-btn" onClick={() => setReload((k) => k + 1)}>
                <IcoRetry />
                Retry
              </button>
            }
          >
            {error} Showing nothing rather than stale rows.
          </Callout>
        )}

        {data && (
          <>
            <div className="rp-grid c4" role="list" aria-label="Summary">
              {(
                [
                  ['Scored', data.inScope.toLocaleString('en-US'), `systems in ${where}`, ''],
                  ['Flagged', data.summary.flagged.toLocaleString('en-US'), 'in the national top 10%', 'red'],
                  ['People', data.summary.flaggedPeople.toLocaleString('en-US'), 'people those systems serve', ''],
                  ['Expected', (Math.round(data.expected * 10) / 10).toLocaleString('en-US'), `violations expected ${state ? 'statewide' : 'nationwide'}`, ''],
                ] as const
              ).map(([k, v, l, tone]) => (
                <div key={k} className="rp-tile" role="listitem">
                  <span className="rp-lbl">{k}</span>
                  <div className={cn('rp-tile-v', tone)}>{v}</div>
                  <p>{l}</p>
                </div>
              ))}
            </div>

            <div className="rp-tri-row">
              <div>
                <span className="rp-lbl">Risk scale</span>
                <CategoryBar
                  className="mt-3"
                  values={[15, 35, 50]}
                  colors={['', TONE.watch, TONE.alert]}
                  showLabels={false}
                  legend={RISK_TIERS.slice()
                    .reverse()
                    .map((t) => ({ name: t.name, range: t.min === 0 ? '<15%' : t.min === 0.15 ? '15–50%' : '≥50%', color: t.cls ? t.color : undefined }))}
                  ticks={rows.map((r) => ({ value: r.p * 100, title: `${nice(r.n)} ${pctText(r.p)}` }))}
                  aria-label="Risk colour scale: under 15% typical, 15 to 50% elevated in ochre, 50% or more high in red"
                />
                {top && (
                  <p className="rp-mono mt-1 text-[11px] leading-snug text-ink-2">
                    ▲ {nice(top.n)} {pctText(top.p)}
                    {low ? ` · ${nice(low.n)} ${pctText(low.p)}` : ''}
                  </p>
                )}
                <p className="rp-note mt-3">Chance of a new health-based violation in {data.meta.year}. Ticks: systems in the queue below.</p>
              </div>
              <div>
                <Capacity data={data} />
              </div>
            </div>

            {hidden ? (
              <Callout
                variant="default"
                icon={IcoInfo}
                title="Showing systems EPA’s formula would not flag yet"
                action={
                  <button type="button" className="rp-btn" onClick={() => setHidden(false)}>
                    Show all
                  </button>
                }
              >
                Their Enforcement Targeting Tool score is under 11, so a formula-driven inspection list skips them, but Taproot’s forecast still ranks them.
              </Callout>
            ) : data.summary.notOnEttList > 0 ? (
              <Callout
                variant="default"
                icon={IcoInfo}
                title="EPA formula misses it"
                action={
                  <button type="button" className="rp-btn" onClick={() => setHidden(true)}>
                    Show {data.summary.notOnEttList.toLocaleString('en-US')}
                  </button>
                }
              >
                {data.summary.notOnEttList.toLocaleString('en-US')} of the systems Taproot flags in {where} have an EPA targeting score under 11, so a formula-driven list would not
                visit them yet.
              </Callout>
            ) : null}

            <section aria-label="Priority queue" className="flex flex-col gap-3">
              <div className="rp-qtitle">
                <h2>Priority queue</h2>
                <span className="rp-lbl" aria-live="polite">
                  {loading ? 'Updating…' : `Sorted by risk · ${Math.min(data.rows.length, data.matched).toLocaleString('en-US')} of ${data.matched.toLocaleString('en-US')}`}
                </span>
              </div>
              {data.rows.length === 0 ? (
                <p className="border-t-2 border-ink pt-4 text-[15px] text-ink-2">No systems match these filters in {where}.</p>
              ) : (
                <div className="rp-queue">
                  <div className="rp-qhead" aria-hidden="true">
                    <div className="rp-qcols">
                      <span>#</span>
                      <span>System</span>
                      <span>People · source</span>
                      <span>{data.meta.year} risk</span>
                      <span>EPA ETT</span>
                      <span>First step</span>
                    </div>
                    <span />
                  </div>
                  <ol className={cn(loading && 'opacity-60')}>
                    {data.rows.map((r, i) => (
                      <Row key={r.id} r={r} rank={i + 1} actions={data.meta.actions} year={data.meta.year} years={data.meta.history_years ?? []} />
                    ))}
                  </ol>
                </div>
              )}
              {data.matched > data.rows.length && (
                <button type="button" onClick={() => setLimit((l) => Math.min(500, l + 50))} className="rp-btn quiet block">
                  Show more
                </button>
              )}
            </section>

            {fair.high && fair.low && (
              <section className="rp-grid c2 thin" aria-label="Fairness check">
                <div className="rp-cell">
                  <span className="rp-lbl">Fairness check · CDC SVI</span>
                  <p className="rp-fair-h">
                    Catches <b>{Math.round(fair.high.recall_top10 * 100)}%</b> of violators in high-vulnerability counties vs <b>{Math.round(fair.low.recall_top10 * 100)}%</b> in low
                  </p>
                  <BarList
                    className="mt-4"
                    sortOrder="none"
                    maxValue={1}
                    valueFormatter={(v) => `${Math.round(v * 100)}%`}
                    data={[
                      { key: 'high', name: 'High vulnerability', short: 'High SVI', value: fair.high.recall_top10, strong: true },
                      { key: 'low', name: 'Low vulnerability', short: 'Low SVI', value: fair.low.recall_top10 },
                    ]}
                  />
                </div>
                <div className="rp-cell">
                  <p className="rp-prose text-[16px]">
                    Nationally, in the most socially vulnerable third of counties, the forecast’s top 10% caught <strong>{Math.round(fair.high.recall_top10 * 100)}%</strong> of next-year
                    violations, against <strong>{Math.round(fair.low.recall_top10 * 100)}%</strong> in the least vulnerable third. Violations there are also more common (
                    {Math.round(fair.high.base_rate * 1000) / 10}% vs {Math.round(fair.low.base_rate * 1000) / 10}% a year), so the queue leans toward the communities that need it.
                  </p>
                  <p className="rp-note mt-3">{data.meta.svi_source}.</p>
                </div>
              </section>
            )}

            <div className="rp-actions">
              <a href="#/impact" className="rp-btn">
                What this list would have caught in 2025 →
              </a>
            </div>
            <p className="rp-foot">
              Forecast: Taproot model on EPA SDWIS records (violations, lead and copper results, inspections, system inventory), backtested on {data.meta.curve.years}.{' '}
              {data.meta.ett_note} Suggested steps are starting points drawn from each system’s record, not engineering advice.
            </p>
          </>
        )}
        {!data && loading && !error && <p className="rp-lbl">Loading the queue…</p>}
      </main>
    </div>
  );
}

export default TriageView;
