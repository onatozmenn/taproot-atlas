import type { TapAnswer } from '../../api';
import '../../styles/record-figures.css';

export function EmptyState({ answer }: { answer: TapAnswer }) {
  const coverage = answer.coverage ?? [];
  return (
    <section className="rf-card">
      <h3>
        <span className="rf-mark" data-tone="typ" style={{ marginRight: 10, verticalAlign: 'middle' }} aria-hidden="true" />
        {answer.place ? `"${answer.place}" is not covered yet` : 'Outside the snapshot'}
      </h3>
      <p className="d">
        {answer.place
          ? 'The snapshot has no record for this place, so no other system is shown in its place.'
          : 'This area is outside the current snapshot.'}
      </p>
      <h4>We only have data for:</h4>
      {coverage.length > 0 ? (
        <div className="rf-chips">
          {coverage.map((c) => (
            <span key={c} className="rf-chip">
              {c}
            </span>
          ))}
          <span className="rf-chip" style={{ background: 'var(--field)' }}>
            + more US systems
          </span>
        </div>
      ) : (
        <p style={{ color: 'var(--ink-2)' }}>Major US community water systems.</p>
      )}
      <p style={{ marginTop: 12, color: 'var(--ink-2)' }}>Ask about one of these cities in plain words, or verify live records at the linked ECHO profile.</p>
    </section>
  );
}
