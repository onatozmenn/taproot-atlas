import { cleanProcesses } from '../../../../lib/answer-composer';
import type { WaterSystemProfile } from '../../../../types/water-intelligence';
import type { TapAnswer } from '../../api';
import { num, titleCase } from '../report/format';
import { VisualFrame } from './frame';

interface Box {
  key: string;
  title: string;
  detail: string;
}

/** "In-U071001Si - South Tempe" → "South Tempe"; "Treatment Facility Tf081 (Fewell)" → "Fewell". */
function cleanName(raw: string): string {
  let s = raw.trim();
  const paren = s.match(/\(([^)]+)\)\s*$/);
  if (paren && /^(treatment|intake|tf|tp|in)\b/i.test(s)) s = paren[1];
  s = s
    .replace(/^(?:in|wl|tp|xtp)-?[\w.]*\s*-\s*/i, '')
    .replace(/^intake\s*\(\d+\)\s*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return titleCase(s || raw);
}

function plural(n: number, w: string) {
  return `${n} ${w}${n === 1 ? '' : 's'}`;
}

/**
 * Source to tap as three register columns: §1 where the water is drawn,
 * §2 where it is treated, §3 the people it reaches. Sources are register
 * blue, plants are ink-outlined, the tap is a solid ink block.
 */
export function SourceJourney({ answer, p, sourceUrl }: { answer: TapAnswer; p: WaterSystemProfile; sourceUrl: string }) {
  const fc = p.facilityCounts;
  const count = (k: string) => Object.entries(fc).filter(([n]) => n.trim().toLowerCase() === k).reduce((a, [, v]) => a + v, 0);
  const intakes = count('intake');
  const wells = count('well');
  const reservoirs = count('reservoir');
  const ground = /ground/i.test(p.primarySource ?? '');

  const sources: Box[] = [];
  if (answer.basins.length > 0) {
    for (const b of answer.basins.slice(0, 2)) sources.push({ key: b, title: b, detail: 'Watershed' });
  } else {
    for (const s of p.sources.slice(0, 2)) sources.push({ key: s.name, title: cleanName(s.name), detail: `${(s.water ?? '').replace(/\s*water$/i, '') || 'Source'} · ${(s.type ?? 'source').trim()}` });
  }
  const top = [...p.purchasedFrom].sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  if (top.length > 0 && sources.length < 3) sources.push({ key: `buy-${top[0].pwsid}`, title: titleCase(top[0].name), detail: top.length > 1 ? `Bought · +${top.length - 1} more` : 'Bought wholesale' });
  if (sources.length === 0) sources.push({ key: 'src', title: ground ? 'Groundwater' : titleCase(p.primarySource ?? 'Local sources'), detail: ground ? 'Pumped from aquifers' : 'Drawn from rivers and lakes' });
  const moreSources = Math.max(0, (answer.basins.length || p.sources.length) - 2);

  const plantCount = p.plants.length || count('treatment plant');
  const plants: Box[] = p.plants.slice(0, 2).map((n) => ({ key: n, title: cleanName(n), detail: 'Treatment plant' }));
  const procs = cleanProcesses(p.treatment.map((t) => t.process)).slice(0, 3);
  if (plants.length === 0) plants.push({ key: 'treat', title: plantCount > 0 ? plural(plantCount, 'treatment plant') : 'Treatment', detail: procs.length > 0 ? 'Reported steps' : 'Filtered and disinfected' });
  const morePlants = Math.max(0, p.plants.length - 2);

  const pts = intakes + wells + reservoirs || p.sourceCount || p.sources.length;
  const ps = (p.primarySource ?? 'Surface water').toLowerCase();
  const kind = ground ? 'Groundwater' : ps.charAt(0).toUpperCase() + ps.slice(1);
  const via = [intakes ? plural(intakes, 'intake') : '', wells ? plural(wells, 'well') : '', reservoirs ? plural(reservoirs, 'reservoir') : ''].filter(Boolean);
  const headline =
    top.length > 0 && pts === 0
      ? `Bought from ${titleCase(top[0].name)}`
      : via.length > 0
        ? `${kind}, drawn through ${via.join(' and ')}`
        : `${kind}${top.length > 0 ? `, partly bought from ${titleCase(top[0].name)}` : ''}`;
  const served = p.population ? (p.population >= 10_000 ? Math.round(p.population / 1000) * 1000 : p.population).toLocaleString('en-US') : null;
  const arrow = (ink?: boolean) => (
    <li className="rf-sj-arrow" data-ink={ink || undefined} aria-hidden="true">
      <svg viewBox="0 0 14 22" className="sj-v">
        <path d="M7 1v18M2.5 14.5 7 19l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      </svg>
      <svg viewBox="0 0 22 14" className="sj-h">
        <path d="M1 7h18M14.5 2.5 19 7l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      </svg>
    </li>
  );

  return (
    <VisualFrame
      fig={7}
      eyebrow="Source to tap"
      record={p.pwsid}
      hero={pts > 0 ? pts : top.length}
      headline={headline}
      note={`${sources.map((s) => s.title).join(' + ')} → ${plants.map((s) => s.title).join(' & ')}${served ? ` → about ${served} people` : ''}.`}
      source="Facilities as reported · schematic"
      sourceUrl={sourceUrl}
    >
      <ol className="rf-sj" aria-label="Water route">
        <li className="rf-sj-col">
          <span className="rf-lbl">§1 Source</span>
          {sources.map((s) => (
            <span key={s.key} className="rf-sj-box" data-src="true">
              <b>{s.title}</b>
              <span>{s.detail}</span>
            </span>
          ))}
          {moreSources > 0 && <p className="rf-sj-more">+ {plural(moreSources, 'more source')}</p>}
        </li>
        {arrow()}
        <li className="rf-sj-col">
          <span className="rf-lbl">§2 Treatment</span>
          {plants.map((s) => (
            <span key={s.key} className="rf-sj-box">
              <b>{s.title}</b>
              <span>{s.detail}</span>
            </span>
          ))}
          {(morePlants > 0 || procs.length > 0) && (
            <p className="rf-sj-more">
              {morePlants > 0 ? `+ ${plural(morePlants, 'more plant')}` : ''}
              {morePlants > 0 && procs.length > 0 ? ' · ' : ''}
              {procs.join(' · ')}
            </p>
          )}
        </li>
        {arrow(true)}
        <li className="rf-sj-col">
          <span className="rf-lbl">
            §3 <span>Your tap</span>
          </span>
          <div className="rf-sj-tap">
            <span className="a">{served ? 'About' : 'Served'}</span>
            <span className="n">{served ?? (p.connections ? num(p.connections) : '–')}</span>
            <span className="p">{served ? 'people served' : 'service connections'}</span>
            <span className="c">
              {titleCase(p.name)}
              {p.connections && served ? ` · ${num(p.connections)} connections` : ''}
            </span>
          </div>
        </li>
      </ol>
      <p className="rf-sj-foot">
        {[via.join(' + ') || kind, plantCount > 0 ? plural(plantCount, 'plant') : 'treatment', 'one distribution system'].join(' → ')}
      </p>
    </VisualFrame>
  );
}
