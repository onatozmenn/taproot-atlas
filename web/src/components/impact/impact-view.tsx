import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRightIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import impact from '../../../../docs/impact.json';
import { Logo } from '../Logo';
import { TONE } from '../visual/frame';

/* Taproot Impact — what the forecast would have changed, checked against what
   actually happened. Route: /#/impact. Numbers: docs/impact.json, built by
   scripts/risk/impact.py from the out-of-time backtest. */

export interface ImpactYear {
  year: number;
  systems: number;
  visits: number;
  violators: number;
  people: number;
  model_caught: number;
  model_people: number;
  ett_caught: number;
  ett_people: number;
  repeat_caught: number;
  repeat_people: number;
  extra_vs_ett: number;
  extra_people: number;
  extra_high_svi: number;
  both: number;
  model_only: number;
  ett_only: number;
  neither: number;
  first_time: number;
  first_time_model: number;
  first_time_ett: number;
  hit_rate_model: number;
  hit_rate_ett: number;
}

const DATA = impact as { note: string; years: ImpactYear[]; context: Array<{ fact: string; source: string; url: string }> };

export const millions = (n: number) => (n >= 1_000_000 ? `${(Math.round(n / 100_000) / 10).toFixed(1)} million` : `${Math.round(n / 1000)}k`);
export const oneIn = (rate: number) => `1 in ${Math.max(1, Math.round(1 / Math.max(rate, 1e-6)))}`;

const GROUPS: Array<{ key: 'both' | 'model_only' | 'ett_only' | 'neither'; label: string; color: string }> = [
  { key: 'model_only', label: 'Only Taproot', color: TONE.water },
  { key: 'both', label: 'Both', color: 'color-mix(in oklab, var(--link) 75%, var(--foreground) 10%)' },
  { key: 'ett_only', label: 'Only EPA formula', color: TONE.watch },
  { key: 'neither', label: 'Neither', color: TONE.faint },
];

/** One dot per system that went on to have a new health-based violation. */
function DotField({ y }: { y: ImpactYear }) {
  const reduce = useReducedMotion();
  const dots: string[] = [];
  for (const g of GROUPS) for (let i = 0; i < y[g.key]; i++) dots.push(g.color);
  return (
    <figure className="rounded-[28px] border bg-card px-5 py-5 sm:px-6" aria-label={`${y.violators} systems with a new health-based violation in ${y.year}`}>
      <div className="flex flex-wrap gap-[5px]" aria-hidden="true">
        {dots.map((c, i) => (
          <motion.span
            key={i}
            className="size-[11px] rounded-full"
            style={{ background: c }}
            initial={reduce ? false : { opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: reduce ? 0 : Math.min(1.2, i * 0.004), duration: 0.25 }}
          />
        ))}
      </div>
      <figcaption className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-4">
        {GROUPS.map((g) => (
          <span key={g.key} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
            <span className="text-muted-foreground">{g.label}</span>
            <span className="ml-auto tabular-nums sm:ml-0">{y[g.key]}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function YearBars({ years }: { years: ImpactYear[] }) {
  const max = Math.max(...years.map((y) => y.violators));
  return (
    <div className="space-y-4">
      {years.map((y) => (
        <div key={y.year}>
          <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
            <span className="font-medium tabular-nums">{y.year}</span>
            <span className="text-muted-foreground tabular-nums">{y.violators} systems had a new violation</span>
          </div>
          {(
            [
              ['Taproot', y.model_caught, TONE.water],
              ['Repeat last year', y.repeat_caught, TONE.faint],
              ['EPA formula', y.ett_caught, TONE.watch],
            ] as Array<[string, number, string]>
          ).map(([label, v, color]) => (
            <div key={label} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 py-0.5 text-[12.5px]">
              <span className="text-muted-foreground">{label}</span>
              <span className="h-2 rounded-full bg-muted">
                <span className="block h-2 rounded-full" style={{ width: `${(v / max) * 100}%`, background: color }} />
              </span>
              <span className="text-right tabular-nums">{v}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ImpactView() {
  const years = DATA.years;
  const [idx, setIdx] = useState(years.length - 1);
  const y = years[idx];
  useEffect(() => {
    document.title = 'Taproot Impact';
  }, []);
  const avgExtraPeople = years.reduce((a, r) => a + r.extra_people, 0) / years.length;

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-2.5 border-b border-border bg-background/85 px-5 backdrop-blur">
        <a href="#/" className="press flex items-center gap-2.5 rounded-full pr-2" aria-label="Back to Taproot Atlas">
          <Logo size={26} />
          <span className="font-display text-[20px] font-medium tracking-tight">Taproot Impact</span>
        </a>
        <a href="#/" className="press ml-auto rounded-full px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground">
          Back to chat
        </a>
      </header>

      <main className="mx-auto w-full max-w-[672px] px-5 pb-24 pt-10">
        <p className="text-[13px] font-medium text-muted-foreground">Checked against what actually happened</p>
        <h1 className="mt-1 text-balance font-display text-[29px] font-medium leading-[1.1] tracking-[-0.01em] sm:text-[42px] sm:leading-[1.08]">
          A list made in January {y.year} would have found {y.model_caught} of the {y.violators} systems that broke a health rule that year.
        </h1>
        <p className="mt-3 text-[16px] leading-snug text-muted-foreground">
          We rebuilt Taproot’s forecast using only records available before {y.year}, took the top 10% ({y.visits.toLocaleString('en-US')} of {y.systems.toLocaleString('en-US')} community
          systems), and compared it with EPA’s enforcement-targeting formula. Same number of systems, same starting date.
        </p>

        <div role="tablist" aria-label="Forecast year" className="mt-6 inline-flex rounded-full border border-border p-0.5">
          {years.map((r, i) => (
            <button
              key={r.year}
              role="tab"
              aria-selected={i === idx}
              onClick={() => setIdx(i)}
              className={cn('press h-8 rounded-full px-3 text-[13px] font-medium tabular-nums text-muted-foreground', i === idx && 'bg-foreground text-background')}
            >
              {r.year}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-3xl bg-muted px-4 py-4">
            <p className="font-display text-[34px] font-medium leading-none tabular-nums" style={{ color: TONE.water }}>
              {y.model_caught}
            </p>
            <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">on Taproot’s list, serving {millions(y.model_people)} people</p>
          </div>
          <div className="rounded-3xl bg-muted px-4 py-4">
            <p className="font-display text-[34px] font-medium leading-none tabular-nums">{y.ett_caught}</p>
            <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">on EPA’s formula list, serving {millions(y.ett_people)} people</p>
          </div>
        </div>

        <div className="mt-4">
          <DotField key={y.year} y={y} />
        </div>

        <section className="mt-10">
          <h2 className="font-display text-[24px] font-medium tracking-tight">Every visit lands better</h2>
          <p className="mt-2 text-[16px] leading-snug">
            {oneIn(y.hit_rate_model)} systems on Taproot’s list went on to have a new health-based violation, against {oneIn(y.hit_rate_ett)} on EPA’s formula list. For an
            inspector with a fixed calendar, that is the difference between a visit that heads off a problem and one that confirms everything is fine.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-[24px] font-medium tracking-tight">Who the extra catches serve</h2>
          <p className="mt-2 text-[16px] leading-snug">
            In {y.year}, {y.extra_vs_ett} systems on Taproot’s list but not EPA’s went on to break a health rule. They serve <strong>{millions(y.extra_people)} people</strong>, and{' '}
            {y.extra_high_svi} of them are in counties in the top quarter of CDC’s Social Vulnerability Index. Averaged over {years[0].year}–{years[years.length - 1].year}, that is about{' '}
            {millions(avgExtraPeople)} people a year.
          </p>
        </section>

        <section className="mt-10 rounded-[28px] border bg-card px-5 py-5 sm:px-6">
          <h2 className="text-[13px] font-medium text-muted-foreground">Three years, same test</h2>
          <div className="mt-3">
            <YearBars years={years} />
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-[24px] font-medium tracking-tight">Why it matters</h2>
          <ul className="mt-3 space-y-3">
            {DATA.context.map((c) => (
              <li key={c.url} className="text-[15px] leading-snug">
                {c.fact}{' '}
                <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 whitespace-nowrap text-[var(--link)]">
                  {c.source}
                  <ArrowUpRightIcon className="size-3.5" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 rounded-3xl bg-muted px-5 py-5">
          <h2 className="text-[13px] font-medium text-muted-foreground">What this does not show</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-snug">
            <li>Being on a list is not the same as a violation prevented; that needs a field trial with a state program.</li>
            <li>
              First-time violators are still hard: of {y.first_time} systems with no health-based violation in the prior five years, Taproot’s list held {y.first_time_model} and EPA’s
              formula {y.first_time_ett}.
            </li>
            <li>People counts use each system’s current population served. EPA’s formula is recomputed from SDWIS records, not EPA’s internal list.</li>
          </ul>
        </section>

        <div className="mt-8 flex flex-wrap gap-2">
          <a href="#/triage" className="press inline-flex h-9 items-center rounded-full bg-foreground px-4 text-[14px] font-medium text-background">
            Open the triage queue
          </a>
          <a href="#/study" className="press inline-flex h-9 items-center rounded-full border border-border px-4 text-[14px] font-medium">
            Help us test Taproot
          </a>
          <a href="#/global" className="press inline-flex h-9 items-center rounded-full border border-border px-4 text-[14px] font-medium">
            Beyond the U.S.
          </a>
        </div>
        <p className="mt-6 text-[12.5px] leading-relaxed text-muted-foreground">{DATA.note}</p>
      </main>
    </div>
  );
}

export default ImpactView;
