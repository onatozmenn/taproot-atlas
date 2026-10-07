import { ChevronDownIcon, DropletIcon, ExternalLinkIcon, FactoryIcon, HomeIcon, MountainIcon, ShieldCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { TapAnswer } from '../../api';
import type { WaterSystemProfile } from '../../../../types/water-intelligence';
import { RealMap } from '../RealMap';
import { LEVEL_BG, LEVEL_COLOR, type Level, month, num, people, titleCase } from './format';
import { LabTable } from './lab-table';
import { LeadChart } from './lead-chart';
import { PfasChart } from './pfas-chart';
import { ViolationsList } from './violations-list';

type Tab = 'overview' | 'lead' | 'pfas' | 'lab' | 'violations' | 'source';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'lead', label: 'Lead' },
  { key: 'pfas', label: 'PFAS' },
  { key: 'lab', label: 'Lab results' },
  { key: 'violations', label: 'Violations' },
  { key: 'source', label: 'Source & route' },
];

export function defaultReportTab(answer: TapAnswer): Tab {
  const q = (answer.question ?? '').toLowerCase();
  if (/\b(lead|pb|service lines?)\b/.test(q) && !/\blead(s|ing)? to\b/.test(q)) return 'lead';
  if (/\b(pfas|pfoa|pfos|forever)\b/.test(q)) return 'pfas';
  if (answer.focus === 'compliance') return 'violations';
  if (answer.focus === 'source' || answer.focus === 'pathway') return 'source';
  if (answer.focus === 'quality') return /\b(safe|quality|healthy|clean)\b/.test(q) ? 'overview' : 'lab';
  return 'overview';
}

function leadLevel(p: WaterSystemProfile): Level {
  if (!p.leadSummary) return 'none';
  return p.leadSummary.latestPpb > 15 ? 'alert' : p.leadSummary.latestPpb >= 10 ? 'watch' : 'ok';
}
function pfasLevel(p: WaterSystemProfile): Level {
  if (!p.pfas.tested) return 'none';
  return p.pfas.aboveMcl.length > 0 ? 'alert' : p.pfas.compoundsDetected.length > 0 ? 'watch' : 'ok';
}
function violLevel(p: WaterSystemProfile): Level {
  const v = p.violationSummary;
  return v.healthBased5Years > 0 || v.unresolved > 0 ? 'alert' : v.last5Years > 0 ? 'watch' : 'ok';
}

function Tile({ label, value, sub, level, onClick }: { label: string; value: string; sub: string; level: Level; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="press group flex min-w-0 flex-col items-start rounded-2xl bg-muted px-3.5 py-3 text-left enabled:hover:bg-secondary"
    >
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-2 rounded-full" style={{ background: LEVEL_COLOR[level] }} aria-hidden="true" />
        {label}
      </span>
      <span className="mt-0.5 text-xl font-semibold tabular-nums leading-tight">{value}</span>
      <span className="truncate text-xs text-muted-foreground">{sub}</span>
    </button>
  );
}

function Findings({ p }: { p: WaterSystemProfile }) {
  return (
    <ul className="space-y-2">
      {p.findings.map((f) => (
        <li key={f.text} className="flex gap-3 text-[15px] leading-snug">
          <span className={cn('mt-0.5 inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-semibold uppercase tracking-wide', LEVEL_BG[f.level])}>
            {f.level === 'alert' ? 'Alert' : f.level === 'watch' ? 'Note' : 'OK'}
          </span>
          <span>{f.text}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-semibold">{title}</h4>
        {right}
      </div>
      {children}
    </section>
  );
}

function SourceRoute({ answer, p }: { answer: TapAnswer; p: WaterSystemProfile }) {
  const fc = p.facilityCounts;
  const stats = [
    { label: 'Intakes', v: fc['Intake'] ?? 0 },
    { label: 'Wells', v: fc['Well'] ?? 0 },
    { label: 'Reservoirs', v: fc['Reservoir'] ?? 0 },
    { label: 'Treatment plants', v: fc['Treatment Plant'] ?? p.plants.length },
    { label: 'Storage tanks', v: fc['Storage'] ?? 0 },
    { label: 'Pump stations', v: fc['Pump Facility'] ?? 0 },
  ].filter((s) => s.v > 0);
  const byObjective = new Map<string, string[]>();
  for (const t of p.treatment) {
    const k = t.objective ?? 'Other';
    byObjective.set(k, [...(byObjective.get(k) ?? []), t.process]);
  }
  const steps: Array<{ icon: typeof MountainIcon; title: string; body: string }> = [
    {
      icon: MountainIcon,
      title: 'Source',
      body: answer.basins.length > 0 ? answer.basins.join(', ') : p.primarySource ?? 'Not reported',
    },
  ];
  if (answer.conveyances.length > 0) steps.push({ icon: DropletIcon, title: 'Conveyance', body: answer.conveyances.map((c) => c.name).join(', ') });
  if (p.purchasedFrom.length > 0)
    steps.push({ icon: DropletIcon, title: 'Wholesale supply', body: p.purchasedFrom.map((s) => titleCase(s.name)).slice(0, 3).join(', ') });
  steps.push({
    icon: FactoryIcon,
    title: 'Treatment',
    body: p.treatment.length > 0 ? `${p.treatment.length} reported processes${p.plants.length > 0 ? ` at ${p.plants.length} plant${p.plants.length === 1 ? '' : 's'}` : ''}` : 'Not reported',
  });
  steps.push({ icon: HomeIcon, title: 'Distribution', body: p.connections ? `${num(p.connections)} service connections` : 'City mains to your tap' });

  return (
    <div className="space-y-5">
      <ol className="grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(120px,1fr))]" aria-label="Source to tap route">
        {steps.map((s, i) => (
          <li key={s.title} className="relative flex items-start gap-2.5 rounded-2xl border p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--link)]/10 text-[var(--link)]">
              <s.icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">
                {i + 1}. {s.title}
              </span>
              <span className="block text-sm font-medium leading-snug">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
      {stats.length > 0 && (
        <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-muted px-3 py-2.5">
              <dd className="text-lg font-semibold tabular-nums">{s.v}</dd>
              <dt className="text-[11px] leading-tight text-muted-foreground">{s.label}</dt>
            </div>
          ))}
        </dl>
      )}
      {p.sources.length > 0 && (
        <Section title="Reported sources">
          <ul className="flex flex-wrap gap-1.5">
            {p.sources.slice(0, 16).map((s) => (
              <li key={s.name} className="rounded-full border px-3 py-1 text-[13px]">
                {s.name}
                <span className="text-muted-foreground"> · {(s.type ?? '').toLowerCase()}</span>
              </li>
            ))}
            {p.sourceCount > 16 && <li className="px-2 py-1 text-[13px] text-muted-foreground">+{p.sourceCount - 16} more</li>}
          </ul>
        </Section>
      )}
      {byObjective.size > 0 && (
        <Section title="Treatment, by purpose">
          <dl className="space-y-2">
            {[...byObjective.entries()].map(([k, v]) => (
              <div key={k} className="grid gap-1 sm:grid-cols-[160px_1fr]">
                <dt className="text-sm text-muted-foreground">{k}</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {v.map((x) => (
                    <span key={x} className="rounded-full bg-secondary px-2.5 py-0.5 text-[13px]">
                      {x}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      )}
      {p.purchasedFrom.length > 0 && (
        <Section title="Buys water from">
          <ul className="space-y-1 text-sm">
            {[...p.purchasedFrom]
              .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
              .map((s) => (
                <li key={s.pwsid}>
                  <span className="font-medium">{titleCase(s.name)}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {s.pwsid}
                    {s.primarySource ? ` · ${s.primarySource.toLowerCase()}` : ''}
                    {s.population ? ` · serves ${people(s.population)}` : ''}
                  </span>
                </li>
              ))}
          </ul>
        </Section>
      )}
      <RealMap answer={answer} />
    </div>
  );
}

/**
 * The full EPA record behind an answer: a glanceable header (people served,
 * lead, PFAS, violations), then tabs that open on the topic asked about.
 */
export function WaterReport({ answer, initiallyOpen }: { answer: TapAnswer; initiallyOpen: boolean }) {
  const p = answer.profile as WaterSystemProfile;
  const [open, setOpen] = useState(initiallyOpen);
  const [tab, setTab] = useState<Tab>(defaultReportTab(answer));
  const pfasRows = p.lab.filter((a) => a.group === 'pfas');
  const go = (t: Tab) => {
    setOpen(true);
    setTab(t);
  };
  const tabs = TABS.filter((t) => (t.key === 'pfas' ? pfasRows.length > 0 : t.key === 'lead' ? p.lead.length > 0 : t.key === 'lab' ? p.lab.length > 0 : true));

  return (
    <div className="evidence animate-rich-content-in mt-5 overflow-hidden rounded-3xl border bg-card">
      <div className="px-5 pt-4">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="press flex w-full items-start gap-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold leading-snug">{answer.placeName} water report</span>
            <span className="block truncate text-sm text-muted-foreground">
              {titleCase(p.name)} · PWSID {p.pwsid}
              {p.counties.length > 0 ? ` · ${p.counties.slice(0, 2).join(', ')} County, ${p.state}` : ''}
            </span>
          </span>
          <ChevronDownIcon className={cn('mt-1 size-5 shrink-0 text-muted-foreground transition-transform duration-300', open && 'rotate-180')} />
        </button>
        <div className="mt-3 grid grid-cols-2 gap-2 pb-4 sm:grid-cols-4">
          <Tile label="People served" value={people(p.population)} sub={(p.primarySource ?? '').toLowerCase() || 'source not reported'} level="none" onClick={() => go('source')} />
          <Tile
            label="Lead, 90th pct"
            value={p.leadSummary ? `${num(p.leadSummary.latestPpb)} ppb` : '–'}
            sub={p.leadSummary ? `limit 15 · ${month(p.leadSummary.latestPeriodEnd)}` : 'no LCR summary'}
            level={leadLevel(p)}
            onClick={p.lead.length > 0 ? () => go('lead') : undefined}
          />
          <Tile
            label="PFAS"
            value={!p.pfas.tested ? '–' : p.pfas.aboveMcl.length > 0 ? `${p.pfas.aboveMcl.length} above limit` : p.pfas.compoundsDetected.length > 0 ? `${p.pfas.compoundsDetected.length} detected` : 'None found'}
            sub={p.pfas.tested ? 'UCMR 5, 29 compounds' : 'not in UCMR 5'}
            level={pfasLevel(p)}
            onClick={pfasRows.length > 0 ? () => go('pfas') : undefined}
          />
          <Tile
            label="Violations, 5 yrs"
            value={String(p.violationSummary.last5Years)}
            sub={`${p.violationSummary.healthBased5Years} health-based`}
            level={violLevel(p)}
            onClick={() => go('violations')}
          />
        </div>
      </div>
      <div className={cn('grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(.22,1,.36,1)]', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
        <div className="min-h-0 overflow-hidden">
          <div className="border-t">
            <div className="scrollbar-none flex gap-1 overflow-x-auto px-3 pt-3 sm:px-4" role="tablist" aria-label="Report sections">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'press h-9 shrink-0 rounded-full px-4 text-sm font-medium',
                    tab === t.key ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div key={tab} className="animate-message-action-in space-y-5 px-5 pb-5 pt-4" role="tabpanel">
              {tab === 'overview' && (
                <>
                  <Section title="Key findings">
                    <Findings p={p} />
                  </Section>
                  {p.lastSanitarySurvey?.date && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ShieldCheckIcon className="size-4" /> Last state inspection {month(p.lastSanitarySurvey.date)} · {p.siteVisitCount} site visits on record
                    </p>
                  )}
                </>
              )}
              {tab === 'lead' && (
                <>
                  <LeadChart series={p.lead} />
                  {p.copper.length > 0 && <LeadChart series={p.copper.map((c) => ({ ...c, ppb: c.ppb / 1000 }))} actionLevel={1.3} unitLabel="mg/L" label="Copper, 90th percentile" />}
                  <p className="text-sm text-muted-foreground">
                    Utilities sample homes most likely to have lead pipes; the 90th percentile is the level 9 in 10 sampled taps were at or under. Lead mostly comes from service lines and
                    plumbing, so your own tap can differ.
                  </p>
                </>
              )}
              {tab === 'pfas' && (
                <>
                  {p.pfas.compoundsDetected.length > 0 ? (
                    <PfasChart rows={pfasRows} />
                  ) : (
                    <p className="rounded-2xl bg-[var(--level-ok-bg)] px-4 py-4 text-[15px] text-[var(--level-ok)]">
                      None of the 29 PFAS compounds in EPA's UCMR 5 survey were detected ({p.pfas.window}).
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    UCMR 5 sampled each large system's entry points from 2023 to 2025. The 2024 PFAS rule sets enforceable limits from 2029; in May 2026 EPA proposed keeping the
                    PFOA and PFOS limits and dropping the others.
                  </p>
                </>
              )}
              {tab === 'lab' && <LabTable rows={p.lab} />}
              {tab === 'violations' && <ViolationsList p={p} />}
              {tab === 'source' && <SourceRoute answer={answer} p={p} />}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
                <span>EPA SDWIS {p.provenance.sdwisQuarter} · Six-Year Review 4 · UCMR 5</span>
                <a href={p.provenance.echoReportUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--link)] hover:underline">
                  EPA ECHO profile <ExternalLinkIcon className="size-3" />
                </a>
                {p.utilityPhone && <span>Utility phone {p.utilityPhone}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
