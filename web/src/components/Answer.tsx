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
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => {
            const status = STATUS_LABEL[m.complianceStatus];
            return (
              <tr key={m.parameter}>
                <td>
                  <strong>{m.parameter}</strong>{' '}
                  <a
                    className="filing"
                    href={m.provenance.sourceDocumentUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Verify ${m.parameter} filing`}
                    title={`Verify ${m.parameter} filing`}
                  >
                    <span className="ext" aria-hidden="true">↗</span>
                  </a>
                </td>
                <td>{m.reportedValue}</td>
                <td>{m.regulatoryThreshold}</td>
                <td>
                  <span className={`status-pill ${status.cls}`}>{status.text}</span>
                </td>
                <td>
                  {m.testDate}
                  <span className="cell-sub">{m.provenance.reportPeriod}</span>
                  <span className="cell-sub">
                    Ingested {m.provenance.captureTime} · {m.provenance.sourceVersionId}
                  </span>
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
  const facilities = answer.facilities ?? [];
  const sellerChain = answer.sellerChain ?? [];
  const lcr = answer.lcr ?? [];
  const ucmr = answer.ucmr ?? [];
  const syr = answer.syr ?? [];
  const distribution = answer.distribution ?? [];
  const conveyances = answer.conveyances ?? [];
  const upstream = answer.upstream ?? null;
  const waterUse = answer.waterUse ?? null;
  const extraMetrics = [...lcr, ...ucmr, ...syr, ...distribution];
  return (
    <div className="answer">
      <div className="markdown">{renderMarkdown(answer.overview)}</div>
      <h4>1. Where it comes from</h4>
      <p className="source-line">
        {answer.basins.length > 0
          ? `Source basins: ${answer.basins.join(' and ')}.`
          : 'Source basins are not yet curated for this system in the snapshot.'}{' '}
        {answer.pwsid !== 'UNKNOWN' && (
          <>
            System: {answer.systemName} · {answer.pwsid}.
          </>
        )}
      </p>
      {facilities.length > 0 && (
        <>
          <h4>Reported facilities (SDWIS)</h4>
          <ul className="nearby-list">
            {facilities.slice(0, 6).map((f) => (
              <li key={f.facilityName}>
                {f.facilityName} · {f.facilityType}
                {f.waterType ? ` · ${f.waterType}` : ''}
              </li>
            ))}
          </ul>
          <p className="fine">Schematic labels only; intake coordinates are never published.</p>
        </>
      )}
      {sellerChain.length > 0 && (
        <p className="tier-line">
          Purchased-water chain: {sellerChain.map((s) => `${s.systemName} (${s.pwsid})`).join('; ')}.
        </p>
      )}
      {answer.facilityProvenanceUrl && (
        <p className="fine">
          <a href={answer.facilityProvenanceUrl} target="_blank" rel="noreferrer">
            Verify facility rows at EPA efservice<span className="ext" aria-hidden="true">↗</span>
          </a>
        </p>
      )}
      {answer.metrics.length > 0 && (
        <>
          <h4>2. What is in it: reported quality</h4>
          <MetricsTable metrics={answer.metrics} />
        </>
      )}
      {extraMetrics.length > 0 && (
        <>
          <h4>More monitoring extracts (LCR / UCMR / SYR / distribution)</h4>
          <MetricsTable metrics={extraMetrics} />
          {ucmr.length > 0 && (
            <p className="fine">UCMR rows are occurrence findings, not federal MCL violations unless the threshold names an MCL.</p>
          )}
        </>
      )}
      <h4>3. How it reaches you: source-to-tap pathway</h4>
      <RealMap answer={answer} />
      {answer.flow.length > 0 && (
        <p className="fine">
          Schematic pathway: {answer.flow.map((f) => f.label).join(' to ')}. Approximations only.
        </p>
      )}
      {conveyances.length > 0 && (
        <p className="tier-line">Large conveyances (schematic): {conveyances.map((c) => c.name).join('; ')}.</p>
      )}
      {upstream && (
        <p className="tier-line">
          Upstream context near {upstream.outletLabel}: {upstream.upstreamCount} flowlines and {upstream.stationCount} pre-treatment
          monitoring stations in range
          {upstream.characteristics.length > 0 ? ` (${upstream.characteristics.join(', ')})` : ''}. Pre-treatment context only.
        </p>
      )}
      {waterUse && (
        <p className="tier-line">
          Modeled supply split for {waterUse.referencePeriod}: about {waterUse.surfacePct} percent surface water and {waterUse.groundPct} percent
          groundwater. Modeled, never a meter reading.
        </p>
      )}
      {(answer.treatment || answer.recordTier !== 'unknown-pending') && (
        <>
          <h4>Treatment and compliance record (pathway detail)</h4>
          {answer.treatment?.rigor ? (
            <p className="rigor-line">{answer.treatment.rigor}.</p>
          ) : (
            <p className="rigor-line">No treatment profile available.</p>
          )}
          {answer.treatment && answer.treatment.processes.length > 0 && (
            <div className="process-chips" aria-label="Reported treatment processes">
              {answer.treatment.processes.map((proc) => (
                <span key={proc} className="process-chip">
                  {proc.toLowerCase().replace(/(^|\s|-)(\S)/g, (m) => m.toUpperCase())}
                </span>
              ))}
            </div>
          )}
          <p className="tier-line">
            {answer.recordTier === 'unknown-pending' &&
              'Compliance records are not yet curated for this window.'}
            {answer.recordTier === 'none-found' &&
              `No violations found in the ${answer.windowStart} to ${answer.windowEnd} window.`}
            {answer.recordTier === 'monitoring-only' &&
              `Only monitoring and reporting violations on record in the ${answer.windowStart} to ${answer.windowEnd} window.`}
            {answer.recordTier === 'other' &&
              `Other violations on record in the ${answer.windowStart} to ${answer.windowEnd} window (not health-based, not monitoring-only). Check the linked ECHO profile for categories.`}
            {answer.recordTier === 'health-based' && (
              <>
                Health-based violations on record in the {answer.windowStart} to {answer.windowEnd}{' '}
                window. Check the{' '}
                <a href={answer.echoUrl} target="_blank" rel="noreferrer">
                  linked ECHO profile<span className="ext" aria-hidden="true">↗</span>
                </a>
                .
              </>
            )}
          </p>
        </>
      )}
      {answer.nearbyPoints.length > 0 && (
        <>
          <h4>Nearby public drinking-water points</h4>
          <ul className="nearby-list">
            {answer.nearbyPoints.map((p) => (
              <li key={p.osmUrl}>
                {p.name} · {p.distanceM} m ·{' '}
                <a href={p.osmUrl} target="_blank" rel="noreferrer">
                  OpenStreetMap<span className="ext" aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="fine">Unverified community data. Boundaries here are unverified.</p>
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
        title={`${answer.systemName} · ${answer.pwsid}: compliance proofs`}
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
