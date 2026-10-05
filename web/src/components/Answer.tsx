import React from 'react';
import type { TapAnswer } from '../api';
import type { QualityMetricRecord } from '../../../types/water-intelligence';
import { RealMap } from './RealMap';
import { renderMarkdown } from '../md';

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
    </div>
  );
}
