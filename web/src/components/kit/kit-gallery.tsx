import { useEffect, useState, type ReactNode } from 'react';
import { Masthead, RecordHeader } from '../triage/record-page';
import { CitePill, ClarifyCard, DropLoader, FollowUpList, RecordChips, SourceStack, ThinkingTrace, useStages, type DropLoaderVariant, type SourceItem, type TraceStep } from '.';

/* Taproot Kit gallery — every primitive, live, with demo records. Route: /#/kit */

const SOURCES: SourceItem[] = [
  { href: 'https://echo.epa.gov/facilities/facility-search', title: 'EPA ECHO compliance profile (AZ0407025)', publisher: 'U.S. EPA' },
  { href: 'https://echo.epa.gov/tools/data-downloads/sdwa-download-summary', title: 'SDWIS federal data, 2026 Q2', publisher: 'U.S. EPA' },
  { href: 'https://www.epa.gov/dwucmr/fifth-unregulated-contaminant-monitoring-rule', title: 'UCMR 5 PFAS and lithium occurrence, 2023-2025', publisher: 'U.S. EPA' },
  { href: 'https://labs.waterdata.usgs.gov/about-nldi/', title: 'USGS upstream network (NLDI)', publisher: 'U.S. Geological Survey' },
];

const STEPS: TraceStep[] = [
  { label: 'Found City of Phoenix', detail: 'AZ0407025' },
  { label: 'Read federal SDWIS records', detail: '2026 Q2' },
  { label: 'Checked lead and copper tests', detail: '11 periods' },
  { label: 'Checked PFAS monitoring (UCMR 5)', detail: '96 samples', tone: 'alert' },
  { label: 'Mapped the service area', detail: 'reported' },
  { label: 'Wrote the answer', detail: 'AI, fact-checked' },
];

function Section({ n, id, title, blurb, children, controls }: { n: number; id: string; title: string; blurb: string; children: ReactNode; controls?: ReactNode }) {
  return (
    <section id={id} className="rp-sec scroll-mt-4" aria-labelledby={`${id}-h`}>
      <div className="rp-sec-h">
        <span className="rp-sec-no">§{String(n).padStart(2, '0')}</span>
        <h2 id={`${id}-h`}>{title}</h2>
        {controls ?? <span />}
      </div>
      <p className="rp-note border-b border-rule py-2.5 text-[13.5px]">{blurb}</p>
      <div className="rp-kit-cell">
        <div>{children}</div>
      </div>
    </section>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="rp-kit-nav">
      {options.map((o) => (
        <button key={o} role="tab" aria-selected={o === value} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

function Replay({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rp-btn quiet">
      Replay
    </button>
  );
}

function TraceDemo() {
  const stage = useStages([700, 900, 900, 900, 900, 800]);
  const working = stage < STEPS.length;
  return <ThinkingTrace steps={STEPS.slice(0, Math.max(1, stage))} working={working} elapsedMs={working ? undefined : 5100} />;
}

export function KitGallery() {
  const [variant, setVariant] = useState<DropLoaderVariant>('rain');
  const [traceKey, setTraceKey] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [clarifyKey, setClarifyKey] = useState(0);
  useEffect(() => {
    document.title = 'Taproot Kit';
  }, []);

  const nav = [
    ['loader', 'Drop Loader'],
    ['trace', 'Thinking Trace'],
    ['sources', 'Sources'],
    ['follow', 'Follow-ups'],
    ['clarify', 'Clarify Card'],
    ['chips', 'Record Chips'],
  ];

  return (
    <div className="rp">
      <RecordHeader page="Kit · primitives">
        <nav className="hidden md:flex" aria-label="Components">
          {nav.map(([id, label]) => (
            <a
              key={id}
              href="#/kit"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="rp-btn ghost"
              style={{ fontSize: 13, padding: '0 10px' }}
            >
              {label}
            </a>
          ))}
        </nav>
      </RecordHeader>
      <main className="rp-main" style={{ maxWidth: 960 }}>
        <Masthead
          kicker={['/#/kit', 'Design register · components']}
          title={
            <>
              Crafted primitives <em>for answers about water.</em>
            </>
          }
          dek="The pieces Taproot uses to wait, show its work, cite its records and ask the next question. Built on Taproot’s tokens, keyboard-ready, and calm under reduced motion."
          meta={[
            { k: 'Pieces', v: '06' },
            { k: 'Direction', v: 'Public Record' },
            { k: 'Motion', v: 'Reduced-motion safe' },
          ]}
        />

        <Section n={1} id="loader" title="Drop Loader" blurb="Water droplets for long lookups, with a live timer so the wait stays honest." controls={<Segmented value={variant} options={['rain', 'ripple', 'flow'] as DropLoaderVariant[]} onChange={setVariant} />}>
          <div className="flex justify-center">
            <DropLoader key={variant} variant={variant} label="Pulling EPA records" />
          </div>
        </Section>

        <Section n={2} id="trace" title="Thinking Trace" blurb="Each record Taproot read, in order. Settles to one line and opens on tap." controls={<Replay onClick={() => setTraceKey((k) => k + 1)} />}>
          <TraceDemo key={traceKey} />
        </Section>

        <Section n={3} id="sources" title="Sources" blurb="A favicon stack that folds the record list open in place, plus an inline cite pill.">
          <p className="rp-serif mb-5 text-[18px] leading-relaxed">
            Phoenix reported PFOS above the 2024 federal limit
            <CitePill source={SOURCES[2]} /> during UCMR 5 monitoring.
          </p>
          <SourceStack sources={SOURCES} />
        </Section>

        <Section n={4} id="follow" title="Follow-ups" blurb="The next questions, quiet and scannable, staggering in after the answer lands.">
          <FollowUpList key={picked ?? 'x'} items={['Is there lead in Phoenix water?', 'Where does Phoenix water come from?', 'Any violations in the last 5 years?']} onPick={setPicked} />
          {picked && <p className="kit-fade-in rp-lbl mt-4">Asked: {picked}</p>}
        </Section>

        <Section n={5} id="clarify" title="Clarify Card" blurb="When a place name fits more than one city. Keys 1 to 9 pick, Enter continues, Esc keeps the first." controls={<Replay onClick={() => setClarifyKey((k) => k + 1)} />}>
          <ClarifyCard
            key={clarifyKey}
            question="Which Springfield did you mean?"
            options={[{ label: 'Springfield, IL', hint: 'City Water, Light & Power · 116,000 people' }, { label: 'Springfield, MO', hint: 'City Utilities · 240,000 people' }, { label: 'Springfield, MA', hint: 'Springfield Water & Sewer · 250,000 people' }]}
            onChoose={() => undefined}
            onSkip={() => undefined}
          />
        </Section>

        <Section n={6} id="chips" title="Record Chips" blurb="The datasets an answer touched. A pulse marks a record with something above a limit.">
          <RecordChips
            chips={[
              { name: 'SDWIS', detail: '2026 Q2' },
              { name: 'LCR', detail: '11 periods' },
              { name: 'UCMR 5', detail: 'PFAS', alert: true },
              { name: 'SYR4', detail: '2012-19' },
              { name: 'Service area', detail: 'reported' },
            ]}
          />
        </Section>

        <footer className="rp-foot">
          Adapted from patterns in Beautiful UI (MIT, © 2026 Shane Levine), rebuilt for Taproot Atlas. Demo values are illustrative.
        </footer>
      </main>
    </div>
  );
}

export default KitGallery;
