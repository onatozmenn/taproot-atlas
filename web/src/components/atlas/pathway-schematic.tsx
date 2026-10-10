import type { TapAnswer } from '../../api';
import { RealMap } from '../RealMap';
import '../../styles/record-figures.css';

const ROLE: Record<string, string> = {
  watershed: 'Source',
  treatment_facility: 'Treatment',
  distribution_zone: 'Distribution',
};

export function PathwaySchematic({ answer }: { answer: TapAnswer }) {
  const steps = answer.flow;
  const conveyances = answer.conveyances ?? [];
  return (
    <div className="space-y-4">
      <section className="rf-card">
        <h3>Source-to-tap pathway</h3>
        <p className="d">Schematic order only; paths are approximations, never engineering alignments.</p>
        {steps.length > 0 ? (
          <ol className="rf-steps" aria-label="Schematic water pathway">
            {steps.map((s, i) => (
              <li key={`${s.label}-${i}`}>
                <span>
                  §{i + 1} {ROLE[s.role] ?? 'Step'}
                </span>
                <b>{s.label}</b>
              </li>
            ))}
          </ol>
        ) : (
          <p style={{ color: 'var(--ink-2)' }}>No curated pathway is available for this system.</p>
        )}
        {conveyances.length > 0 && (
          <>
            <h4>Large conveyances (schematic)</h4>
            <div className="rf-chips">
              {conveyances.map((c) => (
                <span key={c.name} className="rf-chip">
                  {c.name}
                </span>
              ))}
            </div>
          </>
        )}
        {answer.treatment?.rigor ? (
          <p style={{ marginTop: 12 }}>
            Reported treatment: <b>{answer.treatment.rigor}.</b>
          </p>
        ) : (
          <p style={{ marginTop: 12, color: 'var(--ink-2)' }}>No treatment profile available.</p>
        )}
        {answer.upstream && (
          <p style={{ marginTop: 8, color: 'var(--ink-2)' }}>
            Upstream context near {answer.upstream.outletLabel}: {answer.upstream.upstreamCount} flowlines and {answer.upstream.stationCount} pre-treatment monitoring stations in range. Pre-treatment context only.
          </p>
        )}
      </section>
      <RealMap answer={answer} />
    </div>
  );
}
