import type { TapAnswer } from '../../api';
import '../../styles/record-figures.css';

export function SourceCard({ answer }: { answer: TapAnswer }) {
  const facilities = answer.facilities ?? [];
  const sellers = answer.sellerChain ?? [];
  return (
    <section className="rf-card">
      <h3>Water source</h3>
      <p className="d">
        {answer.systemName} · <span className="rf-chip">{answer.pwsid}</span>
      </p>
      <h4>Source basins</h4>
      {answer.basins.length > 0 ? (
        <div className="rf-chips">
          {answer.basins.map((b) => (
            <span key={b} className="rf-chip">
              {b}
            </span>
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--ink-2)' }}>Source basins are not yet curated for this system in the snapshot.</p>
      )}
      {facilities.length > 0 && (
        <>
          <h4>Reported facilities (SDWIS)</h4>
          <ul className="rf-steps" style={{ gridAutoFlow: 'row' }}>
            {facilities.slice(0, 6).map((f) => (
              <li key={f.facilityName}>
                <span>
                  {f.facilityType}
                  {f.waterType ? ` · ${f.waterType}` : ''}
                </span>
                <b>{f.facilityName}</b>
              </li>
            ))}
          </ul>
          <p className="rf-lbl" style={{ marginTop: 6 }}>
            Schematic labels only; intake coordinates are never published.
          </p>
        </>
      )}
      {sellers.length > 0 && (
        <p style={{ marginTop: 12 }}>
          Purchased-water chain: {sellers.map((s) => `${s.systemName} (${s.pwsid})`).join('; ')}.
        </p>
      )}
      {answer.facilityProvenanceUrl && (
        <p style={{ marginTop: 14 }}>
          <a className="rf-btn" href={answer.facilityProvenanceUrl} target="_blank" rel="noreferrer">
            Verify at EPA
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
              <path d="M3.5 2.5h6v6M9.5 2.5l-7 7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
            </svg>
          </a>
        </p>
      )}
    </section>
  );
}
