import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChevronDownIcon } from '@hugeicons/core-free-icons';
import type { TapAnswer } from '../api';
import type { QualityMetricRecord } from '../../../types/water-intelligence';
import { RealMap } from './RealMap';
import { Logo } from './Logo';
import { renderMarkdown } from '../md';

const STATUS_LABEL: Record<QualityMetricRecord['complianceStatus'], { text: string; cls: string }> = {
  within_standard: { text: 'Within standard', cls: 'status-ok' },
  exceeds_standard: { text: 'Exceeds standard', cls: 'status-bad' },
  monitoring_violation: { text: 'Monitoring violation', cls: 'status-warn' },
};

function MetricsTable({ metrics }: { metrics: QualityMetricRecord[] }) {
  return (
    <div className="table-wrap">
      <table className="metrics-table">
        <thead>
          <tr>
            <th scope="col">Parameter</th>
            <th scope="col">Reported</th>
            <th scope="col">Standard</th>
            <th scope="col">Status</th>
            <th scope="col">Tested</th>
            <th scope="col">Filing</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => {
            const status = STATUS_LABEL[m.complianceStatus];
            return (
              <tr key={m.parameter}>
                <td>
                  <strong>{m.parameter}</strong>
                </td>
                <td>{m.reportedValue}</td>
                <td>{m.regulatoryThreshold}</td>
                <td>
                  <span className={`status-pill ${status.cls}`}>{status.text}</span>
                </td>
                <td>
                  {m.testDate}
                  <span className="cell-sub">{m.provenance.reportPeriod}</span>
                </td>
                <td>
                  <a href={m.provenance.sourceDocumentUrl} target="_blank" rel="noreferrer">
                    Verify<span className="ext" aria-hidden="true">↗</span>
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AnswerCard({ answer }: { answer: TapAnswer }) {
  if (answer.scope === 'redirect') {
    // Slim America.gov-style deflection: text only, no map or metric cards.
    const text = [answer.overview, answer.details].filter((p) => p && p.trim().length > 0).join('\n\n');
    return (
      <div className="answer redirect">
        <div className="markdown">{renderMarkdown(text)}</div>
      </div>
    );
  }
  return (
    <div className="answer">
      <div className="markdown">{renderMarkdown(answer.overview)}</div>
      <RealMap answer={answer} />
      {answer.metrics.length > 0 && (
        <>
          <h4>Reported quality metrics</h4>
          <MetricsTable metrics={answer.metrics} />
        </>
      )}
    </div>
  );
}

/**
 * Source pill that expands into the EPA compliance proofs with an animated
 * disclosure. Collapsed by default to save vertical space.
 */
export function SourcePanel({ answer }: { answer: TapAnswer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="source-wrap">
      <button
        type="button"
        className="source-pill toggle"
        aria-expanded={open}
        aria-controls={`compliance-${answer.pwsid}`}
        title={`${answer.systemName} · ${answer.pwsid} — compliance proofs`}
        onClick={() => setOpen((o) => !o)}
      >
        <Logo size={15} />
        <span className="source-text">
          {answer.pwsid === 'UNKNOWN' ? 'Unverified area' : `${answer.systemName} · ${answer.pwsid}`}
        </span>
        <HugeiconsIcon icon={ChevronDownIcon} size={16} />
      </button>
      <div
        id={`compliance-${answer.pwsid}`}
        className={`disclosure${open ? ' open' : ''}`}
      >
        <div className="disclosure-inner">
          <h4>Regulatory compliance (EPA SDWIS)</h4>
          {answer.compliancePending ? (
            <ul>
              <li>
                Monitored period: {answer.windowStart} to {answer.windowEnd}
              </li>
              <li>Records for this system are not yet curated in the snapshot.</li>
              <li>
                <a href={answer.echoUrl} target="_blank" rel="noreferrer">
                  Verify live records at EPA ECHO
                </a>
              </li>
              <li>Record checked at: {answer.verifiedAt}</li>
            </ul>
          ) : (
            <ul>
              <li>
                Monitored period: {answer.windowStart} to {answer.windowEnd}
              </li>
              <li>Violations recorded: {answer.violations} in window</li>
              <li>
                <a href={answer.echoUrl} target="_blank" rel="noreferrer">
                  Access EPA ECHO system profile
                </a>
              </li>
              <li>Record verified at: {answer.verifiedAt}</li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
