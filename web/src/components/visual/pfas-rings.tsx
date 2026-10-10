import type { LabAnalyteSummary, WaterSystemProfile } from '../../../../types/water-intelligence';
import { num } from '../report/format';
import { VisualFrame } from './frame';
import { useBoxWidth } from '../kit/motion';

const RANK = ['PFOA', 'PFOS', 'PFHxS', 'PFNA', 'HFPO-DA'];
const ORDER = (l: string) => {
  const i = RANK.findIndex((r) => l.startsWith(r));
  return i < 0 ? 99 : i;
};

function ngL(a: LabAnalyteSummary): number {
  if (a.maxInBenchmarkUnit !== undefined) return a.maxInBenchmarkUnit;
  const v = a.maxValue ?? 0;
  return a.unit === 'ug/L' ? v * 1000 : v;
}

/**
 * PFAS as a register of lab results: one row per compound, one ring per
 * sample. Hollow = sampled, not detected; ink = detected; red = detected
 * above the 2024 federal limit. The limit sits at the right of each row.
 */
export function PfasRings({ p, sourceUrl }: { p: WaterSystemProfile; sourceUrl: string }) {
  const [boxRef, W] = useBoxWidth<HTMLDivElement>(640, 220);
  const all = p.lab.filter((a) => a.group === 'pfas');
  const rows = all
    .filter((a) => a.benchmark || a.detects > 0)
    .map((a) => {
      const v = a.detects > 0 ? ngL(a) : 0;
      const lim = a.benchmark?.value ?? null;
      return { a, v, lim, ratio: lim && a.detects > 0 ? v / lim : null };
    })
    .sort((x, y) => (y.ratio ?? -1) - (x.ratio ?? -1) || y.a.detects - x.a.detects || (x.lim ?? 1e9) - (y.lim ?? 1e9) || ORDER(x.a.label) - ORDER(y.a.label))
    .slice(0, 8);
  const detected = all.filter((a) => a.detects > 0);
  const tested = all.length;
  const above = rows.filter((r) => (r.ratio ?? 0) > 1).length;
  const anyLimit = detected.some((a) => a.benchmark);
  const samples = p.pfas.samples || Math.max(0, ...all.map((a) => a.samples));
  const window = (p.pfas.window ?? '').match(/(\d{4}).*?(\d{4})/);
  const years = window ? (window[1] === window[2] ? window[1] : `${window[1]} → ${window[2]}`) : '';
  // Rings that fit the row: the name and limit columns take ~165px on a phone.
  const avail = W - (W < 420 ? 165 : 230);
  const maxRings = Math.max(4, Math.floor(avail / 13));
  const per = samples * 11 <= avail ? 1 : Math.ceil(samples / maxRings);
  const nRings = Math.max(1, Math.ceil(samples / per));
  const unitText = per > 1 ? `1 ring = ${per} samples` : `${samples} samples`;
  const headline = detected.length === 0 ? 'No PFAS detected' : above > 0 ? `${above} above the limit` : anyLimit ? 'None above the limit' : `${detected.length} found, none regulated`;
  return (
    <VisualFrame
      fig={3}
      eyebrow={`PFAS · ${tested} compounds × ${samples} samples`}
      record={p.pwsid}
      hero={detected.length}
      unit={detected.length === 1 ? 'detection' : detected.length === 0 ? 'detections' : 'compounds found'}
      headline={headline}
      note={
        detected.length === 0
          ? `Every ring is one lab result. All ${tested || 'tested'} compounds were below the lab's reporting level in every sample.`
          : above > 0
            ? 'Red rings are samples of a compound whose highest result is above its 2024 federal limit.'
            : 'Filled rings are samples where the compound turned up. The limit is the 2024 federal MCL.'
      }
      source={`UCMR 5${years ? ` · ${years.replace(' → ', '–')}` : ''}`}
      sourceUrl={sourceUrl}
    >
      <div ref={boxRef}>
        <div className="rf-pf" role="table" aria-label={`PFAS results, ${samples} samples per compound`}>
          <div role="row" className="contents">
            <span role="columnheader" className="rf-pf-hd">Compound</span>
            <span role="columnheader" className="rf-pf-hd rf-pf-axis">
              {unitText}
              {years && W >= 460 ? ` · ${years}` : ''}
            </span>
            <span role="columnheader" className="rf-pf-hd r">Limit</span>
          </div>
          {rows.map(({ a, v, lim, ratio }) => {
            const over = (ratio ?? 0) > 1;
            const filled = a.detects > 0 ? Math.max(1, Math.round(a.detects / per)) : 0;
            const name = a.label.replace(/\s*\(GenX\)$/i, ' (GenX)');
            return (
              <div role="row" className="contents" key={a.name}>
                <span role="cell" className="rf-pf-name">
                  {name}
                  {a.detects > 0 && (
                    <em data-over={over || undefined}>
                      max {num(v)} ng/L
                      {ratio !== null ? (over ? ` · ${num(ratio)}× limit` : ` · ${Math.max(1, Math.round(ratio * 100))}%`) : ''}
                    </em>
                  )}
                </span>
                <span role="cell" className="rf-pf-rings" style={{ ['--n' as string]: nRings }} aria-label={`${a.detects} of ${a.samples} samples detected`}>
                  {Array.from({ length: nRings }, (_, k) => (
                    <i key={k} data-d={k < filled ? (over ? 'over' : 'det') : undefined} />
                  ))}
                </span>
                <span role="cell" className="rf-pf-lim">
                  {lim !== null ? `${num(lim)} ng/L` : 'none'}
                </span>
              </div>
            );
          })}
        </div>
        <div className="rf-pf-key" aria-hidden="true">
          <span>
            <i /> = sampled, not detected
          </span>
          {detected.length > 0 && (
            <span>
              <i data-d="det" /> = detected
            </span>
          )}
          <span>
            <i data-d="over" /> = over its limit{above === 0 ? ' (none in record)' : ''}
          </span>
        </div>
      </div>
    </VisualFrame>
  );
}
