import React from 'react';
import type { TapAnswer } from '../api';
import type { QualityMetricRecord } from '../../../types/water-intelligence';

export function MetricCard({ metric }: { metric: QualityMetricRecord }) {
  const value = (v: string | undefined) => (v && v.length > 0 ? v : 'not reported');
  return (
    <div className="metric">
      <div className="metric-top">
        <strong>{value(metric.parameter)}</strong>
        <span>{value(metric.reportedValue)}</span>
      </div>
      <ul>
        <li>
          Regulatory standard: {value(metric.regulatoryThreshold)} ({value(metric.complianceStatus)})
        </li>
        <li>
          Test / reporting period: {value(metric.testDate)} ({value(metric.provenance.reportPeriod)})
        </li>
        <li>
          Ingested: {value(metric.provenance.captureTime)} · Version:{' '}
          <code>{value(metric.provenance.sourceVersionId)}</code>
        </li>
        <li>
          <a href={metric.provenance.sourceDocumentUrl} target="_blank" rel="noreferrer">
            Verify regulatory filing
          </a>
        </li>
      </ul>
    </div>
  );
}

export function ValidationLine({ answer }: { answer: TapAnswer }) {
  return (
    <>
      <p className="validation-line">
        {answer.passedAudit ? 'Verified summary' : 'Deterministic summary (audit fallback)'} · audited{' '}
        {answer.auditTimestamp}
      </p>
      <p className="validation-line">
        {answer.recordSource === 'snapshot_fixture' ? (
          <>
            Demonstration snapshot ·{' '}
            <a href={answer.echoUrl} target="_blank" rel="noreferrer">
              verify live at ECHO
            </a>
          </>
        ) : (
          <>Live ECHO record · captured {answer.verifiedAt}</>
        )}
      </p>
    </>
  );
}

export function SchematicMap({ answer }: { answer: TapAnswer }) {
  return (
    <div className="map-card" role="img" aria-label={`Schematic flow from ${answer.basins.join(' and ') || 'unverified area'} to distribution`}>
      <div className="map-head">
        <span className={`badge ${answer.boundaryType === 'VERIFIED_AGENCY' ? 'badge-verified' : 'badge-modeled'}`}>
          {answer.boundaryType === 'VERIFIED_AGENCY' ? 'Verified boundary' : 'Unverified boundary'}
        </span>
        <span className="map-note">Schematic — not an engineering alignment</span>
      </div>
      <svg viewBox="0 0 400 140" className="map-svg" aria-hidden="true">
        <line x1="70" y1="70" x2="170" y2="70" strokeWidth="2" strokeDasharray="6 4" className="flow-line" />
        <line x1="230" y1="70" x2="330" y2="70" strokeWidth="2" strokeDasharray="6 4" className="flow-line" />
        <g>
          <ellipse cx="45" cy="70" rx="42" ry="30" className="node-watershed" />
          <text x="45" y="74" textAnchor="middle" className="node-label">{answer.basins[0] ?? 'Area'}</text>
        </g>
        <g>
          <rect x="170" y="45" width="60" height="50" rx="8" className="node-plant" />
          <text x="200" y="74" textAnchor="middle" className="node-label">Treatment</text>
        </g>
        <g>
          <ellipse cx="355" cy="70" rx="42" ry="30" className="node-zone" />
          <text x="355" y="74" textAnchor="middle" className="node-label">Tap zone</text>
        </g>
      </svg>
      <div className="map-foot">
        <span>{answer.basins.length > 0 ? `${answer.basins.join(' → ')} → Treatment → Tap zone` : 'Outside showcase snapshot — unverified area'}</span>
      </div>
    </div>
  );
}

export function AnswerCard({ answer }: { answer: TapAnswer }) {
  return (
    <div className="answer">
      <ValidationLine answer={answer} />
      <p>{answer.overview}</p>
      <SchematicMap answer={answer} />
      {answer.metrics.length > 0 && (
        <>
          <h4>Reported quality metrics</h4>
          {answer.metrics.map((m) => (
            <MetricCard key={m.parameter} metric={m} />
          ))}
        </>
      )}
      <h4>Regulatory compliance (EPA SDWIS)</h4>
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
      <p className="disclaimer">{answer.disclaimer}</p>
    </div>
  );
}
