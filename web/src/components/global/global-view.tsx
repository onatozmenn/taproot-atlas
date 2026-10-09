import { ArrowUpRightIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import ral from '../../../../data/global/ie-ral-2025q4.json';
import { Logo } from '../Logo';
import { TONE } from '../visual/frame';

/* Taproot Global — how the method travels. Route: /#/global.
   Ireland's EPA Remedial Action List (end of 2025) is shown as a working
   import: data/global/ie-ral-2025q4.json, parsed by scripts/global/ie_ral.py. */

interface RalRow {
  code: string;
  county: string;
  name: string;
  pop: number;
  reasons: string[];
}

const ROWS = (ral as RalRow[]).slice().sort((a, b) => b.pop - a.pop);
const IE_PEOPLE = ROWS.reduce((a, r) => a + r.pop, 0);

const REASON: Record<string, string> = {
  cryptosporidium: 'Cryptosporidium barrier',
  disinfection: 'Disinfection',
  ecoli: 'E. coli',
  thm: 'Byproducts (THMs)',
  pesticides: 'Pesticides',
  hse: 'Health service flag',
  aluminium: 'Aluminium',
  turbidity: 'Turbidity',
  audit: 'Audit findings',
};

type Level = 'live' | 'ready' | 'partial' | 'coming' | 'missing';
const LEVEL: Record<Level, { label: string; color: string }> = {
  live: { label: 'Live in Taproot', color: TONE.water },
  ready: { label: 'Data ready', color: 'color-mix(in oklab, var(--link) 60%, transparent)' },
  partial: { label: 'Partly ready', color: TONE.watch },
  coming: { label: 'Required by law, arriving', color: TONE.faint },
  missing: { label: 'Not published', color: 'var(--muted)' },
};

export const READINESS: Array<{ place: string; level: Level; registry: string; results: string; actions: string; source: string; url: string }> = [
  {
    place: 'United States',
    level: 'live',
    registry: 'Every public system (SDWIS)',
    results: 'Violations and lab results',
    actions: 'Site visits, enforcement',
    source: 'EPA ECHO',
    url: 'https://echo.epa.gov/tools/data-downloads/sdwa-download-summary',
  },
  {
    place: 'Ireland',
    level: 'ready',
    registry: 'Every public supply',
    results: '2025 monitoring results, all supplies',
    actions: 'At-risk list, 197 inspections in 2025',
    source: 'EPA Ireland',
    url: 'https://eparesearch.epa.ie/safer/iso19115/display?isoID=20267',
  },
  {
    place: 'England and Wales',
    level: 'partial',
    registry: '24 companies, supply zones',
    results: 'Zone compliance, yearly',
    actions: '586 events in England, 2025',
    source: 'Drinking Water Inspectorate',
    url: 'https://www.dwi.gov.uk/what-we-do/annual-report/drinking-water-2025/drinking-water-2025-summary-of-the-chief-inspectors-report-for-drinking-water-in-england/water-supplies-and-testing',
  },
  {
    place: 'European Union',
    level: 'coming',
    registry: 'Supply zones',
    results: 'Monitoring and incident datasets',
    actions: 'Risk-based approach, catchment data by July 2027',
    source: 'Directive (EU) 2020/2184',
    url: 'https://eur-lex.europa.eu/EN/legal-content/summary/drinking-water-essential-quality-standards.html',
  },
];

const OWR_EXAMPLE = `{
  "country": "IE",
  "systemId": "1900PUB1032",
  "name": "Limerick City Environs",
  "region": "Co. Limerick",
  "population": 126790,
  "exceedances": [
    { "date": "2025-08-14", "parameter": "THM", "value": 112, "limit": 100, "unit": "µg/L" }
  ],
  "actions": [
    { "date": "2025-12-31", "kind": "watchlist", "reasons": ["thm"] }
  ]
}`;

export function GlobalView() {
  const [all, setAll] = useState(false);
  useEffect(() => {
    document.title = 'Taproot Global';
  }, []);
  const shown = all ? ROWS : ROWS.slice(0, 8);
  const maxPop = ROWS[0]?.pop ?? 1;

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-2.5 border-b border-border bg-background/85 px-5 backdrop-blur">
        <a href="#/" className="press flex items-center gap-2.5 rounded-full pr-2" aria-label="Back to Taproot Atlas">
          <Logo size={26} />
          <span className="font-display text-[20px] font-medium tracking-tight">Taproot Global</span>
        </a>
        <a href="#/" className="press ml-auto rounded-full px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground">
          Back to chat
        </a>
      </header>

      <main className="mx-auto w-full max-w-[672px] px-5 pb-24 pt-10">
        <p className="text-[13px] font-medium text-muted-foreground">Beyond the United States</p>
        <h1 className="mt-1 font-display text-[36px] font-medium leading-[1.08] tracking-[-0.01em] sm:text-[42px]">
          2.1 billion people lack safely managed drinking water. Most regulators can’t yet see which systems will fail next.
        </h1>
        <p className="mt-3 text-[16px] leading-snug text-muted-foreground">
          Only 43% of countries say their regulators publish public reports on urban drinking-water quality, and about one in five run checks at the frequency their own rules
          require. Taproot turns the records a regulator already keeps into a list of where to look first.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            ['2.1 billion', 'without safely managed water in 2024', 'https://www.who.int/news/item/26-08-2025-1-in-4-people-globally-still-lack-access-to-safe-drinking-water---who--unicef'],
            ['43%', 'of countries publish urban water-quality reports', 'https://www.unwater.org/sites/default/files/2026-01/un-water_glaas2025_report_english.pdf'],
            ['21%', 'run urban surveillance at the required frequency', 'https://www.unwater.org/sites/default/files/2026-01/un-water_glaas2025_report_english.pdf'],
          ].map(([v, l, u]) => (
            <a key={l} href={u} target="_blank" rel="noreferrer" className="press block rounded-3xl bg-muted px-4 py-4 hover:bg-secondary">
              <p className="font-display text-[26px] font-medium leading-none tabular-nums">{v}</p>
              <p className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">{l}</p>
            </a>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">WHO/UNICEF JMP 2025; UN-Water GLAAS 2025 (105 countries).</p>

        <section className="mt-10">
          <h2 className="font-display text-[24px] font-medium tracking-tight">Three records are enough</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              ['Who it serves', 'A list of systems with population and water source.'],
              ['What the tests found', 'Results or failures against the health limits.'],
              ['What the regulator did', 'Inspections, directions and watch-lists.'],
            ].map(([t, d], i) => (
              <div key={t} className="rounded-3xl border border-border px-4 py-4">
                <p className="font-mono text-[12px] text-[var(--tertiary)]">{i + 1}</p>
                <p className="mt-1 text-[15px] font-semibold">{t}</p>
                <p className="mt-1 text-[13.5px] leading-snug text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10" aria-label="Where the records exist">
          <h2 className="font-display text-[24px] font-medium tracking-tight">Where those records already exist</h2>
          <ul className="mt-3 divide-y divide-border rounded-[28px] border bg-card">
            {READINESS.map((r) => (
              <li key={r.place} className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: LEVEL[r.level].color }} />
                  <span className="text-[16px] font-semibold">{r.place}</span>
                  <span className="ml-auto text-[12.5px] text-muted-foreground">{LEVEL[r.level].label}</span>
                </div>
                <p className="mt-1.5 text-[13.5px] leading-snug text-muted-foreground">
                  {r.registry} · {r.results} · {r.actions}.{' '}
                  <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 whitespace-nowrap text-[var(--link)]">
                    {r.source}
                    <ArrowUpRightIcon className="size-3.5" />
                  </a>
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10" aria-label="Ireland at-risk supplies">
          <h2 className="font-display text-[24px] font-medium tracking-tight">Ireland, already imported</h2>
          <p className="mt-2 text-[16px] leading-snug">
            Ireland’s EPA keeps a register of public supplies at risk. At the end of 2025 it held <strong>{ROWS.length} supplies serving {IE_PEOPLE.toLocaleString('en-US')} people</strong>. Taproot
            reads it today; like EPA’s formula in the U.S., it flags supplies after problems show. Feeding every supply’s 2025 test results into the same model is how
            Taproot would find the next ones before they get here.
          </p>
          <ul className="mt-4 space-y-2.5">
            {shown.map((r) => (
              <li key={r.code} className="rounded-2xl border border-border px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-medium">{r.name}</span>
                  <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">{r.pop.toLocaleString('en-US')} people</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                  <div className="h-1.5 rounded-full" style={{ width: `${Math.max(2, (r.pop / maxPop) * 100)}%`, background: TONE.water }} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
                  <span className="text-muted-foreground">Co. {r.county}</span>
                  {r.reasons.map((x) => (
                    <span key={x} className="rounded-full bg-secondary px-2 py-0.5">
                      {REASON[x] ?? x}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {ROWS.length > 8 && (
            <button type="button" onClick={() => setAll((v) => !v)} className={cn('press mt-3 h-9 rounded-full border border-border px-4 text-[14px] font-medium')}>
              {all ? 'Show fewer' : `Show all ${ROWS.length}`}
            </button>
          )}
          <p className="mt-3 text-[12.5px] text-muted-foreground">
            Source: EPA Ireland Remedial Action List, Q4 2025. Reasons parsed from the published table; being listed means treatment must be fixed, not that water is unsafe today.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-[24px] font-medium tracking-tight">One format for any regulator</h2>
          <p className="mt-2 text-[16px] leading-snug">
            Each country plugs in through a small adapter that writes the Open Water Record. Ireland’s adapter is a dozen lines; a country with no public records can start from
            this format.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-muted px-4 py-3 font-mono text-[12.5px] leading-relaxed">{OWR_EXAMPLE}</pre>
          <p className="mt-1.5 text-[12px] text-muted-foreground">Illustrative values in the exceedance line.</p>
        </section>

        <div className="mt-8 flex flex-wrap gap-2">
          <a
            href={`#/ask?q=${encodeURIComponent('Is Limerick water on the at-risk list in Ireland?')}`}
            className="press inline-flex h-9 items-center rounded-full bg-foreground px-4 text-[14px] font-medium text-background"
          >
            Ask about an Irish supply
          </a>
          <a href="#/impact" className="press inline-flex h-9 items-center rounded-full border border-border px-4 text-[14px] font-medium">
            See the U.S. backtest
          </a>
        </div>
      </main>
    </div>
  );
}

export default GlobalView;
