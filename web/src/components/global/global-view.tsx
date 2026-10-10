import { Fragment, useEffect, useState, type ReactNode } from 'react';
import ral from '../../../../data/global/ie-ral-2025q4.json';
import { ExtLink, Masthead, RecordHeader, Sec } from '../triage/record-page';

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
/* Readiness marks: □ ok (green) when the records are there, ■ ochre where
   something is missing and needs attention, □ grey when not yet published. */
const LEVEL: Record<Level, { label: string; mark: string; on: boolean }> = {
  live: { label: 'Live in Taproot', mark: 'ok', on: false },
  ready: { label: 'Data ready', mark: 'ok', on: false },
  partial: { label: 'Partly ready', mark: 'elev', on: true },
  coming: { label: 'Arriving by law', mark: 'typ', on: false },
  missing: { label: 'Not published', mark: 'typ', on: false },
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
    { "date": "2025-08-14", "parameter": "THM",
      "value": 112, "limit": 100, "unit": "µg/L" }
  ],
  "actions": [
    { "date": "2025-12-31", "kind": "watchlist", "reasons": ["thm"] }
  ]
}`;

/** Light JSON colouring for the Open Water Record block: keys and strings. */
function JsonCode({ code }: { code: string }) {
  const parts: ReactNode[] = [];
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(code))) {
    parts.push(code.slice(last, m.index));
    parts.push(
      <span key={i++} className={m[2] ? 'k' : 's'}>
        {m[1]}
      </span>,
    );
    if (m[2]) parts.push(m[2]);
    last = m.index + m[0].length;
  }
  parts.push(code.slice(last));
  return (
    <pre className="rp-code" tabIndex={0} aria-label="Open Water Record example">
      {parts.map((p, j) => (
        <Fragment key={j}>{p}</Fragment>
      ))}
    </pre>
  );
}

export function GlobalView() {
  const [all, setAll] = useState(false);
  useEffect(() => {
    document.title = 'Taproot Global';
  }, []);
  const shown = all ? ROWS : ROWS.slice(0, 8);
  const maxPop = ROWS[0]?.pop ?? 1;

  return (
    <div className="rp">
      <RecordHeader page="Global · beyond the U.S." />

      <main className="rp-main">
        <Masthead
          kicker={['/#/global', 'Beyond the United States']}
          title="Most regulators can’t yet see which systems will fail next."
          dek={
            <>
              Only 43% of countries say their regulators publish public reports on urban drinking-water quality, and about one in five run checks at the frequency their own rules
              require. Taproot turns the records a regulator already keeps into a list of where to look first.
            </>
          }
          meta={[
            { k: 'Live', v: 'U.S. · EPA SDWIS' },
            { k: 'Imported', v: 'Ireland · EPA RAL Q4 2025' },
            { k: 'Format', v: 'Open Water Record' },
            { k: 'Sources', v: 'WHO/UNICEF JMP · GLAAS 2025' },
          ]}
        />

        <div className="rp-two">
          <div className="l" style={{ borderTop: '3px solid var(--ink)', paddingTop: 16 }}>
            <span className="rp-gl-n">
              2.1<small>billion</small>
            </span>
            <p className="rp-gl-p">
              people lack safely managed drinking water{' '}
              <span className="rp-mono whitespace-nowrap text-[12px] text-ink-2">(WHO/UNICEF JMP 2025)</span>
            </p>
          </div>
          <div className="r">
            <div className="rp-grid c2 keep2" style={{ height: '100%' }}>
              {[
                ['43%', 'of countries publish urban water-quality reports', 'https://www.unwater.org/sites/default/files/2026-01/un-water_glaas2025_report_english.pdf'],
                ['21%', 'run urban surveillance at the required frequency', 'https://www.unwater.org/sites/default/files/2026-01/un-water_glaas2025_report_english.pdf'],
              ].map(([v, l, u]) => (
                <a key={l} href={u} target="_blank" rel="noreferrer" className="rp-tile">
                  <span className="rp-lbl">UN-Water GLAAS 2025</span>
                  <div className="rp-tile-v">{v}</div>
                  <p>{l}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
        <p className="rp-note -mt-3">2.1 billion without safely managed water in 2024 (WHO/UNICEF JMP 2025); UN-Water GLAAS 2025 surveyed 105 countries.</p>

        <Sec no="1" title="Three records are enough" note="What a regulator needs to keep">
          <div className="rp-grid c3 thin">
            {[
              ['Who it serves', 'A list of systems with population and water source.'],
              ['What the tests found', 'Results or failures against the health limits.'],
              ['What the regulator did', 'Inspections, directions and watch-lists.'],
            ].map(([t, d], i) => (
              <div key={t} className="rp-cell">
                <span className="rp-sec-no" style={{ display: 'inline-block' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="mt-3 text-[17px] font-bold tracking-[-0.01em]">{t}</p>
                <p className="mt-1 text-[14px] leading-snug text-ink-2">{d}</p>
              </div>
            ))}
          </div>
        </Sec>

        <div className="rp-two">
          <div className="l">
            <Sec no="2" title="Readiness by country" note="Where those records already exist" label="Where the records exist">
              <ul className="-mt-4">
                {READINESS.map((r) => (
                  <li key={r.place} className="rp-rd">
                    <div>
                      <b>{r.place}</b>
                      <p>
                        {r.registry} · {r.results} · {r.actions}. <ExtLink href={r.url}>{r.source}</ExtLink>
                      </p>
                    </div>
                    <span className={`rp-mark ${LEVEL[r.level].mark}`} data-on={LEVEL[r.level].on}>
                      {LEVEL[r.level].label}
                    </span>
                  </li>
                ))}
              </ul>
            </Sec>
          </div>
          <div className="r">
            <Sec no="3" title="One format for any regulator" note="Open Water Record · schema">
              <p className="rp-prose text-[16px]">
                Each country plugs in through a small adapter that writes the Open Water Record. Ireland’s adapter is a dozen lines; a country with no public records can start from
                this format.
              </p>
              <div className="mt-4">
                <JsonCode code={OWR_EXAMPLE} />
              </div>
              <p className="rp-note mt-2">Illustrative values in the exceedance line.</p>
            </Sec>
          </div>
        </div>

        <Sec no="4" title="Ireland, already imported" note="EPA Ireland Remedial Action List, Q4 2025" label="Ireland at-risk supplies">
          <p className="rp-prose">
            Ireland’s EPA keeps a register of public supplies at risk. At the end of 2025 it held <strong>{ROWS.length} supplies serving {IE_PEOPLE.toLocaleString('en-US')} people</strong>. Taproot
            reads it today; like EPA’s formula in the U.S., it flags supplies after problems show. Feeding every supply’s 2025 test results into the same model is how Taproot would
            find the next ones before they get here.
          </p>
          <ul className="mt-4 border-t-2 border-ink">
            {shown.map((r) => (
              <li key={r.code} className="rp-ie">
                <b>{r.name}</b>
                <span className="pp">{r.pop.toLocaleString('en-US')} people</span>
                <span className="bar" aria-hidden="true">
                  <i style={{ width: `${Math.max(1, (r.pop / maxPop) * 100)}%` }} />
                </span>
                <span className="tags">
                  <span>
                    {r.code} · Co. {r.county}
                  </span>
                  {r.reasons.map((x) => (
                    <span key={x}>{REASON[x] ?? x}</span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          {ROWS.length > 8 && (
            <button type="button" onClick={() => setAll((v) => !v)} className="rp-btn quiet block mt-3">
              {all ? 'Show fewer' : `Show all ${ROWS.length}`}
            </button>
          )}
          <p className="rp-note mt-3">
            Source: EPA Ireland Remedial Action List, Q4 2025. Reasons parsed from the published table; being listed means treatment must be fixed, not that water is unsafe today.
          </p>
        </Sec>

        <div className="rp-actions">
          <a href={`#/ask?q=${encodeURIComponent('Is Limerick water on the at-risk list in Ireland?')}`} className="rp-btn primary">
            Ask about an Irish supply
          </a>
          <a href="#/impact" className="rp-btn">
            See the U.S. backtest
          </a>
        </div>
      </main>
    </div>
  );
}

export default GlobalView;
