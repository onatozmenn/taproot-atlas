import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRightIcon, ChevronDownIcon, MessageCircleIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { driverText } from '../../../../lib/risk-text';
import type { RiskDriver } from '../../../../types/water-intelligence';
import { Logo } from '../Logo';
import { TONE } from '../visual/frame';

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
  if (name !== name.toUpperCase()) return name;
  return name
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\b(Of|And|The)\b/g, (w) => w.toLowerCase())
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

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'press h-8 rounded-full border px-3 text-[13px] font-medium transition-colors',
        on ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

/** "If you can reach N systems, how much of next year's trouble do you meet?" */
function Capacity({ data }: { data: TriageData }) {
  const reduce = useReducedMotion();
  const scope = data.inScope;
  const maxN = Math.max(1, Math.round(scope * 0.3));
  const [n, setN] = useState(() => Math.max(1, Math.round(scope * 0.05)));
  useEffect(() => setN(Math.max(1, Math.round(scope * 0.05))), [scope]);
  const c = data.meta.curve;
  const share = n / scope;
  const model = caught(c.model, c.share_visited, share);
  const ett = caught(c.ett, c.share_visited, share);
  const repeat = caught(c.repeat, c.share_visited, share);
  const bars: Array<[string, number, string]> = [
    ['Taproot forecast', model, TONE.water],
    ['Repeat last year’s violators', repeat, TONE.faint],
    ['EPA targeting formula', ett, TONE.faint],
  ];
  return (
    <section className="rounded-[28px] border bg-card px-5 py-5 sm:px-6" aria-label="Capacity planner">
      <p className="text-[13px] font-medium text-muted-foreground">If your team can reach</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="font-display text-[34px] font-medium leading-none tabular-nums">{n.toLocaleString('en-US')}</span>
        <span className="text-[15px] text-muted-foreground">
          of {scope.toLocaleString('en-US')} systems ({Math.round(share * 1000) / 10}%) this year
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={maxN}
        value={n}
        onChange={(e) => setN(Number(e.target.value))}
        aria-label="Systems your team can reach"
        className="mt-4 w-full accent-[var(--link)]"
      />
      <p className="mt-4 text-[15px] leading-snug">
        Taking them in Taproot’s order meets about <strong>{Math.round(model * 100)}%</strong> of next year’s new health-based violations
        {data.expected >= 5 ? (
          <> (≈{Math.round(model * data.expected)} of {Math.round(data.expected)} expected)</>
        ) : data.expected > 0 ? (
          <> (only about {Math.max(1, Math.round(data.expected))} expected here a year, so read this as the national rate)</>
        ) : null}
        .
      </p>
      <div className="mt-3 space-y-2">
        {bars.map(([label, v, color]) => (
          <div key={label} className="grid grid-cols-[minmax(0,11rem)_1fr_3rem] items-center gap-3 text-[13px]">
            <span className="truncate text-muted-foreground">{label}</span>
            <div className="h-2 rounded-full bg-muted">
              <motion.div className="h-2 rounded-full" style={{ background: color }} initial={reduce ? false : { width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ duration: 0.5 }} />
            </div>
            <span className="text-right tabular-nums">{Math.round(v * 100)}%</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] text-muted-foreground">
        One backtest ({c.years}, all U.S. systems Taproot scores), read at the share of systems you can reach: each method visits its own top {Math.round(share * 1000) / 10}%.
      </p>
    </section>
  );
}

function Row({ r, rank, actions, year }: { r: TriageRow; rank: number; actions: Record<Action, string>; year: number }) {
  const [open, setOpen] = useState(false);
  const tone = r.p >= 0.2 ? TONE.alert : r.p >= 0.05 ? TONE.watch : TONE.water;
  const ask = `What's the risk of a new violation at ${nice(r.n)} next year?`;
  return (
    <li className="border-b border-border last:border-b-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="press flex w-full items-center gap-3 px-1 py-3.5 text-left">
        <span className="w-7 shrink-0 text-right font-mono text-[12px] tabular-nums text-[var(--tertiary)]">{rank}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15.5px] font-semibold leading-tight">{nice(r.n)}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground">
            <span>
              {r.c ? `${r.c}, ` : ''}
              {r.st} · {people(r.pop)} people
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-foreground">{ACTION_SHORT[r.a]}</span>
            {r.ett < 11 && r.p >= 0.05 && <span className="rounded-full px-2 py-0.5" style={{ background: 'color-mix(in oklab, var(--level-watch) 18%, transparent)' }}>Not flagged by EPA formula</span>}
            {(r.svi ?? 0) >= VULNERABLE && <span className="rounded-full bg-muted px-2 py-0.5">High social vulnerability</span>}
          </span>
        </span>
        <span className="flex w-[84px] shrink-0 flex-col items-end">
          <span className="text-[17px] font-semibold tabular-nums" style={{ color: tone }}>
            {pctText(r.p)}
          </span>
          <span className="mt-1 h-1.5 w-full rounded-full bg-muted">
            <span className="block h-1.5 rounded-full" style={{ width: `${Math.max(3, r.p * 100)}%`, background: tone }} />
          </span>
        </span>
        <ChevronDownIcon className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="animate-rich-content-in pb-4 pl-10 pr-1">
          <p className="text-[14px]">
            <span className="text-muted-foreground">Suggested first step: </span>
            <strong>{actions[r.a]}</strong>
          </p>
          <ul className="mt-2 space-y-1 text-[14px]">
            {drivers(r).map((d) => (
              <li key={d.f}>
                <span style={{ color: d.dir === 'up' ? TONE.alert : TONE.ok }}>{d.dir === 'up' ? '↑ ' : '↓ '}</span>
                {driverText(d)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            {Math.round(r.p * 1000) / 10}% chance of a new health-based violation in {year} · EPA targeting score {r.ett}
            {r.svi !== null ? ` · county vulnerability ${ordinal(Math.round(r.svi * 100))} percentile` : ''} · {r.id}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`#/ask?q=${encodeURIComponent(ask)}&pwsid=${encodeURIComponent(r.id)}`}
              className="press inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3 text-[13px] font-medium text-background"
            >
              <MessageCircleIcon className="size-3.5" />
              Ask Taproot about this system
            </a>
            <a
              href={`https://echo.epa.gov/detailed-facility-report?fid=${encodeURIComponent(r.id)}`}
              target="_blank"
              rel="noreferrer"
              className="press inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-[var(--link)]"
            >
              EPA record
              <ArrowUpRightIcon className="size-3.5" />
            </a>
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
  }, [state, action, hidden, vulnerable, limit]);

  const where = state ? STATES[state] : 'the U.S.';
  const fair = useMemo(() => {
    const f = data?.meta.fairness ?? [];
    return { high: f.find((x) => x.svi === 'high'), low: f.find((x) => x.svi === 'low') };
  }, [data]);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-2.5 border-b border-border bg-background/85 px-5 backdrop-blur">
        <a href="#/" className="press flex items-center gap-2.5 rounded-full pr-2" aria-label="Back to Taproot Atlas">
          <Logo size={26} />
          <span className="font-display text-[20px] font-medium tracking-tight">Taproot Triage</span>
        </a>
        <a href="#/" className="press ml-auto rounded-full px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground">
          Back to chat
        </a>
      </header>

      <main className="mx-auto w-full max-w-[672px] px-5 pb-24 pt-10">
        <p className="text-[13px] font-medium text-muted-foreground">For state programs, utilities and technical-assistance teams</p>
        <h1 className="mt-1 font-display text-[36px] font-medium leading-[1.08] tracking-[-0.01em] sm:text-[42px]">Where should the next visit go?</h1>
        <p className="mt-3 text-[16px] leading-snug text-muted-foreground">
          Every community water system serving 3,300+ people, ranked by Taproot’s forecast of a new health-based violation in {data?.meta.year ?? 2026}. A priority list
          for inspections, help and funding, not a verdict on anyone’s water.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
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
            className="h-9 rounded-full border border-border bg-background px-3 text-[14px] font-medium"
          >
            <option value="">All states</option>
            {Object.entries(STATES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <Chip on={hidden} onClick={() => setHidden((h) => !h)}>
            Not flagged by EPA formula
          </Chip>
          <Chip on={vulnerable} onClick={() => setVulnerable((v) => !v)}>
            High social vulnerability
          </Chip>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Suggested first step">
          <Chip on={action === ''} onClick={() => setAction('')}>
            Any issue
          </Chip>
          {(['monitoring', 'lead', 'dbp', 'micro', 'chem', 'deficiency', 'surface', 'enforcement', 'watch'] as Action[]).map((a) => (
            <Chip key={a} on={action === a} onClick={() => setAction(action === a ? '' : a)}>
              {ACTION_SHORT[a]}
            </Chip>
          ))}
        </div>

        {error && <p className="mt-8 rounded-2xl bg-muted px-4 py-3 text-[14px]">{error}</p>}

        {data && (
          <>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                [data.summary.flagged.toLocaleString('en-US'), `in the national top 10%, in ${where}`],
                [people(data.summary.flaggedPeople), 'people those systems serve'],
                [data.summary.notOnEttList.toLocaleString('en-US'), 'of them EPA’s formula would not flag yet'],
              ].map(([v, l]) => (
                <div key={l} className="rounded-3xl bg-muted px-4 py-4">
                  <p className="font-display text-[26px] font-medium leading-none tabular-nums">{v}</p>
                  <p className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">{l}</p>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <Capacity data={data} />
            </div>

            <section className="mt-8" aria-label="Priority queue">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-[24px] font-medium tracking-tight">Priority queue</h2>
                <span className="text-[13px] text-muted-foreground">
                  {loading ? 'Updating…' : `${Math.min(data.rows.length, data.matched).toLocaleString('en-US')} of ${data.matched.toLocaleString('en-US')}`}
                </span>
              </div>
              {data.rows.length === 0 ? (
                <p className="mt-4 text-[15px] text-muted-foreground">No systems match these filters in {where}.</p>
              ) : (
                <ol className={cn('mt-2', loading && 'opacity-60')}>
                  {data.rows.map((r, i) => (
                    <Row key={r.id} r={r} rank={i + 1} actions={data.meta.actions} year={data.meta.year} />
                  ))}
                </ol>
              )}
              {data.matched > data.rows.length && (
                <button type="button" onClick={() => setLimit((l) => Math.min(500, l + 50))} className="press mt-4 h-9 w-full rounded-full border border-border text-[14px] font-medium">
                  Show more
                </button>
              )}
            </section>

            {fair.high && fair.low && (
              <section className="mt-10 rounded-[28px] border bg-card px-5 py-5 sm:px-6" aria-label="Fairness check">
                <p className="text-[13px] font-medium text-muted-foreground">Fairness check</p>
                <p className="mt-1 text-[16px] leading-snug">
                  Nationally, in the most socially vulnerable third of counties, the forecast’s top 10% caught <strong>{Math.round(fair.high.recall_top10 * 100)}%</strong> of next-year
                  violations, against <strong>{Math.round(fair.low.recall_top10 * 100)}%</strong> in the least vulnerable third. Violations there are also more common (
                  {Math.round(fair.high.base_rate * 1000) / 10}% vs {Math.round(fair.low.base_rate * 1000) / 10}% a year), so the queue leans toward the communities that need it.
                </p>
                <p className="mt-2 text-[12.5px] text-muted-foreground">{data.meta.svi_source}.</p>
              </section>
            )}

            <a href="#/impact" className="press mt-8 inline-flex h-9 items-center rounded-full border border-border px-4 text-[14px] font-medium">
              What this list would have caught in 2025 →
            </a>
            <p className="mt-8 text-[12.5px] leading-relaxed text-muted-foreground">
              Forecast: Taproot model on EPA SDWIS records (violations, lead and copper results, inspections, system inventory), backtested on {data.meta.curve.years}.{' '}
              {data.meta.ett_note} Suggested steps are starting points drawn from each system’s record, not engineering advice.
            </p>
          </>
        )}
        {!data && loading && !error && <p className="mt-8 text-[14px] text-muted-foreground">Loading the queue…</p>}
      </main>
    </div>
  );
}

export default TriageView;
