import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { TapAnswer } from '../../api';
import type { QualityMetricRecord } from '../../../../types/water-intelligence';
import '../../styles/record-figures.css';

function statusMark(status: QualityMetricRecord['complianceStatus']) {
  switch (status) {
    case 'within_standard':
      return (
        <span className="rf-mark" data-tone="ok">
          Within standard
        </span>
      );
    case 'exceeds_standard':
      return (
        <span className="rf-mark" data-tone="flag" data-on="true">
          Exceeds standard
        </span>
      );
    default:
      return (
        <span className="rf-mark" data-tone="typ">
          Monitoring
        </span>
      );
  }
}

function shortDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function MetricTable({ metrics }: { metrics: QualityMetricRecord[] }) {
  return (
    <div className="rf-tbl-wrap">
      <table className="rf-tbl">
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Reported</th>
            <th>Standard</th>
            <th>Status</th>
            <th>Tested</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.parameter} style={m.complianceStatus === 'exceeds_standard' ? { background: 'var(--notice-tint)' } : undefined}>
              <td>
                <a href={m.provenance.sourceDocumentUrl} target="_blank" rel="noreferrer" aria-label={`Verify ${m.parameter} filing`}>
                  {m.parameter}
                </a>
              </td>
              <td className="m">{m.reportedValue}</td>
              <td className="m">{m.regulatoryThreshold}</td>
              <td>{statusMark(m.complianceStatus)}</td>
              <td className="m">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help underline decoration-dotted underline-offset-2">{shortDate(m.testDate)}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {m.testDate} · {m.provenance.reportPeriod}
                      <br />
                      Ingested {m.provenance.captureTime} · {m.provenance.sourceVersionId}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QualityTable({ answer }: { answer: TapAnswer }) {
  const extra = [...(answer.lcr ?? []), ...(answer.ucmr ?? []), ...(answer.syr ?? []), ...(answer.distribution ?? [])];
  return (
    <section className="rf-card">
      <h3>Reported quality</h3>
      <p className="d">Laboratory results as reported, with the regulatory benchmark for each row.</p>
      <div className="rf-note" role="note">
        <b aria-hidden="true">□</b>
        <span>Reports only. Never a safety verdict. Verify at the official source.</span>
      </div>
      {answer.metrics.length > 0 ? (
        <MetricTable metrics={answer.metrics} />
      ) : (
        <p style={{ color: 'var(--ink-2)' }}>No reported lab metrics are available for this system in the current snapshot.</p>
      )}
      {extra.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h4>More monitoring extracts (LCR / UCMR / SYR / distribution)</h4>
          <MetricTable metrics={extra} />
          {(answer.ucmr ?? []).length > 0 && (
            <p className="rf-lbl" style={{ marginTop: 6 }}>
              UCMR rows are occurrence findings, not federal MCL violations unless the threshold names an MCL.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
