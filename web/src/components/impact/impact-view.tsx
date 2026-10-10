import { useEffect, useState } from 'react';
import impact from '../../../../docs/impact.json';
import { ExtLink, Masthead, RecordHeader, Sec } from '../triage/record-page';

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
const short = (n: number) => (n >= 1_000_000 ? `${(Math.round(n / 100_000) / 10).toFixed(1)}M` : `${Math.round(n / 1000)}k`);
export const oneIn = (rate: number) => `1 in ${Math.max(1, Math.round(1 / Math.max(rate, 1e-6)))}`;

const GROUPS: Array<{ key: 'both' | 'model_only' | 'ett_only' | 'neither'; label: string }> = [
  { key: 'model_only', label: 'Only Taproot' },
  { key: 'both', label: 'Both lists' },
  { key: 'ett_only', label: 'Only EPA formula' },
  { key: 'neither', label: 'Neither' },
];

/** One dot per system that went on to have a new health-based violation; filled = it was on the list. */
function DotField({ total, hit, blue, label }: { total: number; hit: number; blue?: boolean; label: string }) {
  return (
    <div className={`rp-dots${blue ? ' blue' : ''}`} role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < hit ? 'on' : undefined} />
      ))}
    </div>
  );
}

function YearBars({ years }: { years: ImpactYear[] }) {
  const max = Math.max(...years.map((y) => y.violators));
  return (
    <div className="rp-grid c3 thin">
      {years.map((y) => (
        <div key={y.year} className="rp-cell">
          <div className="flex items-baseline justify-between gap-3">
            <span className="rp-mono text-[15px] font-semibold">{y.year}</span>
            <span className="rp-lbl">{y.violators} new violators</span>
          </div>
          <div className="mt-3 border-t border-rule">
            {(
              [
                ['Taproot', y.model_caught, true],
                ['Repeat last year', y.repeat_caught, false],
                ['EPA formula', y.ett_caught, false],
              ] as Array<[string, number, boolean]>
            ).map(([label, v, me]) => (
              <div key={label} className={`rp-bl${me ? ' strong' : ''}`} style={{ gridTemplateColumns: 'minmax(84px, 120px) minmax(0, 1fr) 40px' }}>
                <span className="rp-bl-n">{label}</span>
                <span className="rp-bl-b" aria-hidden="true">
                  <i style={{ width: `${(v / max) * 100}%`, background: me ? 'var(--register)' : undefined }} />
                </span>
                <span className="rp-bl-v">{v}</span>
              </div>
            ))}
          </div>
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
  const firstTimeNote =
    y.first_time_model <= y.first_time_ett ? 'no better than EPA here.' : y.first_time_model - y.first_time_ett <= 3 ? 'barely better than EPA here.' : 'better, but still a minority.';

  return (
    <div className="rp">
      <RecordHeader page="Impact · backtest" />

      <main className="rp-main">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap justify-between gap-3">
            <span className="rp-lbl blue">/#/impact · Checked against what actually happened</span>
            <span className="rp-lbl">Backtest · health-based violations</span>
          </div>
          <div role="tablist" aria-label="Forecast year" className="rp-tabs">
            {years.map((r, i) => (
              <button key={r.year} type="button" role="tab" aria-selected={i === idx} onClick={() => setIdx(i)}>
                {r.year}
              </button>
            ))}
          </div>
        </div>

        <Masthead
          kicker={[`Forecast made January ${y.year}`, `Top 10% · ${y.visits.toLocaleString('en-US')} of ${y.systems.toLocaleString('en-US')} systems`]}
          h1Props={{ className: 'rp-lead' }}
          title={
            <>
              In {y.year}, Taproot’s top-10% list held <b>{y.model_caught}</b> of the {y.violators} systems that went on to a health-based violation — EPA’s formula held{' '}
              <b>{y.ett_caught}</b>.
            </>
          }
          dek={
            <>
              We rebuilt Taproot’s forecast using only records available before {y.year}, took the top 10% ({y.visits.toLocaleString('en-US')} of {y.systems.toLocaleString('en-US')}{' '}
              community systems), and compared it with EPA’s enforcement-targeting formula. Same number of systems, same starting date.
            </>
          }
        />

        <div className="flex flex-col gap-3">
          <div className="rp-cmp" key={y.year}>
            <div>
              <div className="rp-cmp-h">
                <span className="rp-lbl">Taproot top 10%</span>
                <span className="rp-cmp-n" style={{ color: 'var(--register)' }}>
                  {y.model_caught}
                  <small>/{y.violators}</small>
                </span>
              </div>
              <DotField total={y.violators} hit={y.model_caught} blue label={`${y.model_caught} of ${y.violators} on Taproot’s list`} />
              <p className="rp-note mt-3">Serving {millions(y.model_people)} people.</p>
            </div>
            <div>
              <div className="rp-cmp-h">
                <span className="rp-lbl">EPA formula (ETT) top 10%</span>
                <span className="rp-cmp-n">
                  {y.ett_caught}
                  <small>/{y.violators}</small>
                </span>
              </div>
              <DotField total={y.violators} hit={y.ett_caught} label={`${y.ett_caught} of ${y.violators} on EPA’s formula list`} />
              <p className="rp-note mt-3">Serving {millions(y.ett_people)} people.</p>
            </div>
          </div>
          <p className="rp-note">Each dot is one system that had a new health-based violation in {y.year}. Filled = it was on the list a year earlier.</p>
          <div className="rp-split" aria-label="Overlap of the two lists">
            {GROUPS.map((g) => (
              <div key={g.key}>
                <span>{g.label}</span>
                <b>{y[g.key]}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="rp-kv">
          <div>
            <span className="rp-lbl">People in caught systems</span>
            <b>
              {short(y.model_people)} <span>vs {short(y.ett_people)} people</span>
            </b>
            <p>
              In {y.year}, {y.extra_vs_ett} systems on Taproot’s list but not EPA’s went on to break a health rule. They serve <strong>{millions(y.extra_people)} people</strong>, and{' '}
              {y.extra_high_svi} of them are in counties in the top quarter of CDC’s Social Vulnerability Index. Averaged over {years[0].year}–{years[years.length - 1].year}, that is about{' '}
              {millions(avgExtraPeople)} people a year.
            </p>
          </div>
          <div>
            <span className="rp-lbl">Inspection yield</span>
            <b>
              {oneIn(y.hit_rate_model)} <span>visits finds a violator vs {oneIn(y.hit_rate_ett)}</span>
            </b>
            <p>
              {oneIn(y.hit_rate_model)} systems on Taproot’s list went on to have a new health-based violation, against {oneIn(y.hit_rate_ett)} on EPA’s formula list. For an inspector
              with a fixed calendar, that is the difference between a visit that heads off a problem and one that confirms everything is fine.
            </p>
          </div>
        </div>

        <div className="rp-limit">
          <span className="rp-mark elev" data-on="true">
            Honest limit
          </span>
          <p>
            First-time violators: {y.first_time_model} vs {y.first_time_ett} — {firstTimeNote}
          </p>
        </div>

        <Sec no="1" title="Three years, same test" note="Out-of-time backtest, top 10% each year">
          <YearBars years={years} />
        </Sec>

        <Sec no="2" title="Why it matters" note="Sources">
          <ol>
            {DATA.context.map((c, i) => (
              <li key={c.url} className="rp-src">
                <span className="n">{i + 1}</span>
                <p>
                  {c.fact} <ExtLink href={c.url}>{c.source}</ExtLink>
                </p>
              </li>
            ))}
          </ol>
        </Sec>

        <Sec no="3" title="What this does not show" note="Read before quoting">
          <ul className="rp-ol">
            <li>
              <span>01</span>
              <span>Being on a list is not the same as a violation prevented; that needs a field trial with a state program.</span>
            </li>
            <li>
              <span>02</span>
              <span>
                First-time violators are still hard: of {y.first_time} systems with no health-based violation in the prior five years, Taproot’s list held {y.first_time_model} and EPA’s
                formula {y.first_time_ett}.
              </span>
            </li>
            <li>
              <span>03</span>
              <span>People counts use each system’s current population served. EPA’s formula is recomputed from SDWIS records, not EPA’s internal list.</span>
            </li>
          </ul>
        </Sec>

        <div className="rp-actions">
          <a href="#/triage" className="rp-btn primary">
            Open the triage queue
          </a>
          <a href="#/study" className="rp-btn">
            Help us test Taproot
          </a>
          <a href="#/global" className="rp-btn">
            Beyond the U.S.
          </a>
        </div>
        <p className="rp-foot">{DATA.note}</p>
      </main>
    </div>
  );
}

export default ImpactView;
