import type { TapAnswer } from '../../api';
import '../../styles/record-figures.css';

function tierText(answer: TapAnswer): string {
  switch (answer.recordTier) {
    case 'unknown-pending':
      return 'Compliance records are not yet curated for this window.';
    case 'none-found':
      return `No violations found in the ${answer.windowStart} to ${answer.windowEnd} window.`;
    case 'monitoring-only':
      return `Only monitoring and reporting violations on record in the ${answer.windowStart} to ${answer.windowEnd} window.`;
    case 'other':
      return `Other violations on record in the ${answer.windowStart} to ${answer.windowEnd} window (not health-based, not monitoring-only). Check the linked ECHO profile for categories.`;
    case 'health-based':
      return `Health-based violations on record in the ${answer.windowStart} to ${answer.windowEnd} window.`;
  }
}

const Ext = () => (
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
    <path d="M3.5 2.5h6v6M9.5 2.5l-7 7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
  </svg>
);

export function ComplianceCard({ answer }: { answer: TapAnswer }) {
  const processes = answer.treatment?.processes ?? [];
  const flagged = answer.recordTier === 'health-based';
  return (
    <section className="rf-card">
      <h3>Regulatory compliance</h3>
      <p className="d">EPA SDWIS record-keeping for the monitored window.</p>
      <dl className="rf-dl">
        <div>
          <dt>Monitored period</dt>
          <dd>
            {answer.windowStart} to {answer.windowEnd}
          </dd>
        </div>
        <div>
          <dt>Violations recorded</dt>
          <dd style={flagged ? { color: 'var(--notice)' } : undefined}>{answer.compliancePending ? 'Not yet curated' : answer.violations}</dd>
        </div>
      </dl>
      <p>{tierText(answer)}</p>
      {processes.length > 0 && (
        <div>
          <h4>Reported treatment steps</h4>
          <div className="rf-chips" aria-label="Reported treatment processes">
            {processes.map((p) => (
              <span key={p} className="rf-chip">
                {p.toLowerCase().replace(/(^|\s|-)(\S)/g, (m) => m.toUpperCase())}
              </span>
            ))}
          </div>
        </div>
      )}
      <p style={{ marginTop: 14 }}>
        <a className="rf-btn" href={answer.echoUrl} target="_blank" rel="noreferrer">
          {answer.compliancePending ? 'Verify live records at EPA ECHO' : 'Access EPA ECHO system profile'} <Ext />
        </a>
      </p>
      <p className="rf-lbl" style={{ marginTop: 10 }}>
        Record verified at: {answer.verifiedAt}
      </p>
    </section>
  );
}
