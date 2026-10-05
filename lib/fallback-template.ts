// lib/fallback-template.ts
// Deterministic English summary rendered directly from Resolver ground truth.
// Used whenever the LLM narrative fails audit.
import type {
  QualityMetricRecord,
  WaterOriginSchematic,
} from '../types/water-intelligence.js';

export function generateDeterministicSummary(
  schematic: WaterOriginSchematic
): string {
  const isUnknown = schematic.pwsid === 'UNKNOWN' || schematic.primaryBasins.length === 0;
  const basins =
    schematic.primaryBasins.length === 1
      ? `${schematic.primaryBasins[0]} basin`
      : schematic.primaryBasins.length > 1
        ? `${schematic.primaryBasins.join(' and ')} basins`
        : 'areas outside the current showcase snapshot';
  const boundarySentence =
    schematic.boundaryType === 'verified_agency'
      ? 'The service area shown is agency-published.'
      : schematic.boundaryType === 'modeled_epa'
        ? 'The service area shown is modeled from EPA geography.'
        : 'Exact service-area boundaries are not shown here.';
  const violationsCount = schematic.regulatoryCompliance.totalViolationsFound;
  const windowStart = schematic.regulatoryCompliance.queryWindow.startDate;
  const windowEnd = schematic.regulatoryCompliance.queryWindow.endDate;

  const metricsList = schematic.latestReportedMetrics.length > 0
    ? schematic.latestReportedMetrics
        .map((m: QualityMetricRecord) => {
          return [
            `- **${m.parameter}**: ${m.reportedValue}`,
            `  - *Regulatory Standard:* ${m.regulatoryThreshold} (${m.complianceStatus})`,
            `  - *Test / Reporting Period:* ${m.testDate} (${m.provenance.reportPeriod})`,
            `  - *Data Ingestion Time:* ${m.provenance.captureTime} | *Version:* \`${m.provenance.sourceVersionId}\``,
            `  - *Official Source Document:* [Verify Regulatory Filing](${m.provenance.sourceDocumentUrl})`,
          ].join('\n');
        })
        .join('\n\n')
    : 'No reported lab metrics are available for this system in the current snapshot.';

  const heading = isUnknown
    ? '### Unverified Area Overview'
    : '### Verified Water Distribution Overview';

  const complianceBlock = schematic.regulatoryCompliance.snapshotPending
    ? [
        `- **Monitored Period:** ${windowStart} to ${windowEnd}`,
        `- **Snapshot Status:** Compliance records for this system are not yet curated in the snapshot.`,
        `- **Enforcement History:** [Access EPA ECHO System Profile](${schematic.regulatoryCompliance.echoReportUrl})`,
        `- **Record Verified At:** ${schematic.regulatoryCompliance.dataCaptureTime}`,
      ].join('\n')
    : [
        `- **Monitored Period:** ${windowStart} to ${windowEnd}`,
        `- **Violations Recorded:** ${violationsCount} violation(s) found in statutory audit window.`,
        `- **Enforcement History:** [Access EPA ECHO System Profile](${schematic.regulatoryCompliance.echoReportUrl})`,
        `- **Record Verified At:** ${schematic.regulatoryCompliance.dataCaptureTime}`,
      ].join('\n');

  const detailSentence =
    schematic.latestReportedMetrics.length > 0
      ? `The ${schematic.latestReportedMetrics[0].provenance.reportPeriod} report's lab metrics ` +
        `and the ${windowStart} to ${windowEnd} compliance record are detailed below.`
      : 'Lab metrics and compliance records for this system are not yet curated, ' +
        'so verify live records at the linked ECHO profile.';

  return `
${heading}
Water for public water system **${schematic.systemName} (PWSID: ${schematic.pwsid})** is primarily sourced from the **${basins}**. ${detailSentence}

*Spatial Accuracy Notice:* ${boundarySentence} Flow paths and boundaries displayed on the map represent **schematic approximations** and do not depict operational engineering alignments.

### Reported Water Quality Metrics & Audit Provenance
${metricsList}

### Regulatory Compliance Record (EPA SDWIS)
${complianceBlock}

---
*Mandatory Public Health Notice:* ${schematic.disclaimer}
`.trim();
}
