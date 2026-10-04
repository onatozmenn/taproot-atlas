import React from 'react';
import type { TapAnswer } from '../api';

export function SchematicMap({ answer }: { answer: TapAnswer }) {
  return (
    <div className="map-card" role="img" aria-label={`Schematic flow from ${answer.basins.join(' and ')} basins to distribution`}>
      <div className="map-head">
        <span className={`badge ${answer.boundaryType === 'VERIFIED_AGENCY' ? 'badge-verified' : 'badge-modeled'}`}>
          {answer.boundaryType === 'VERIFIED_AGENCY' ? 'Verified boundary' : answer.boundaryType}
        </span>
        <span className="map-note">Schematic — not an engineering alignment</span>
      </div>
      <svg viewBox="0 0 400 140" className="map-svg" aria-hidden="true">
        <line x1="70" y1="70" x2="170" y2="70" strokeWidth="2" strokeDasharray="6 4" className="flow-line" />
        <line x1="230" y1="70" x2="330" y2="70" strokeWidth="2" strokeDasharray="6 4" className="flow-line" />
        <g>
          <ellipse cx="45" cy="70" rx="42" ry="30" className="node-watershed" />
          <text x="45" y="74" textAnchor="middle" className="node-label">{answer.basins[0]}</text>
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
        <span>{answer.basins.join(' → ')} → Treatment → Tap zone</span>
      </div>
    </div>
  );
}

export function AnswerCard({ answer }: { answer: TapAnswer }) {
  return (
    <div className="answer">
      <p>
        Water for public water system <strong>{answer.systemName} (PWSID: {answer.pwsid})</strong> is
        primarily sourced from the <strong>{answer.basins.join(' and ')}</strong> basins.
      </p>
      <SchematicMap answer={answer} />
      <h4>Reported quality metrics</h4>
      {answer.metrics.map((m) => (
        <div key={m.parameter} className="metric">
          <div className="metric-top">
            <strong>{m.parameter}</strong>
            <span>{m.reportedValue}</span>
          </div>
          <ul>
            <li>Regulatory standard: {m.regulatoryThreshold} ({m.complianceStatus})</li>
            <li>Test / reporting period: {m.testDate} ({m.reportPeriod})</li>
            <li>
              Ingested: {m.captureTime} · Version: <code>{m.version}</code>
            </li>
            <li>
              <a href={m.sourceUrl} target="_blank" rel="noreferrer">Verify regulatory filing</a>
            </li>
          </ul>
        </div>
      ))}
      <h4>Regulatory compliance (EPA SDWIS)</h4>
      <ul>
        <li>Monitored period: {answer.windowStart} to {answer.windowEnd}</li>
        <li>Violations recorded: {answer.violations} in window</li>
        <li>
          <a href={answer.echoUrl} target="_blank" rel="noreferrer">Access EPA ECHO system profile</a>
        </li>
        <li>Record verified at: {answer.verifiedAt}</li>
      </ul>
      <p className="disclaimer">{answer.disclaimer}</p>
    </div>
  );
}
