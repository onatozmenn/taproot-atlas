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
  const isUnknown = schematic.pwsid === 'UNKNOWN';
  const isTierB = !isUnknown && schematic.primaryBasins.length === 0;
  const basins =
    schematic.primaryBasins.length === 1
      ? `${schematic.primaryBasins[0]} basin`
      : schematic.primaryBasins.length > 1
        ? `${schematic.primaryBasins.join(' and ')} basins`
        : 'areas outside the current showcase snapshot';
  const violationsCount = schematic.regulatoryCompliance.totalViolationsFound;
  const windowStart = schematic.regulatoryCompliance.queryWindow.startDate;
  const windowEnd = schematic.regulatoryCompliance.queryWindow.endDate;
  const allMetrics = [
    ...schematic.latestReportedMetrics,
    ...(schematic.lcrMetrics ?? []),
    ...(schematic.ucmrMetrics ?? []),
    ...(schematic.syrMetrics ?? []),
    ...(schematic.distributionMetrics ?? []),
  ];
  const detailSentence =
    allMetrics.length > 0
      ? `The ${allMetrics[0].provenance.reportPeriod} report's lab metrics ` +
        `and the ${windowStart} to ${windowEnd} compliance record are detailed below.`
      : 'Lab metrics and compliance records for this system are not yet curated, ' +
        'so verify live records at the linked ECHO profile.';
  const sourceSentence = isTierB
    ? `Water for public water system **${schematic.systemName} (PWSID: ${schematic.pwsid})**. ` +
      'Source details for this system are not yet curated in the snapshot, ' +
      'so verify live records at the linked ECHO profile.'
    : `Water for public water system **${schematic.systemName} (PWSID: ${schematic.pwsid})** is primarily sourced from the **${basins}**. ` +
      `${detailSentence}`;
  const boundarySentence =
    schematic.boundaryType === 'verified_agency'
      ? 'The service area shown is agency-published.'
      : schematic.boundaryType === 'modeled_epa'
        ? 'The service area shown is modeled from EPA geography.'
        : 'Exact service-area boundaries are not shown here.';
  const metricsList = allMetrics.length > 0
    ? allMetrics
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

  const occurrenceNote =
    (schematic.ucmrMetrics ?? []).length > 0
      ? 'UCMR rows are occurrence findings, not federal MCL violations unless the threshold column names an MCL.'
      : null;

  const heading = isUnknown
    ? '### Unverified Area Overview'
    : isTierB
      ? '### Water System Overview'
      : schematic.boundaryType === 'verified_agency' || schematic.boundaryType === 'modeled_epa'
        ? '### Verified Water Distribution Overview'
        : '### Water System Overview';

  const pathwayLabels = schematic.schematicFlow.features
    .map((f) => f.properties.label)
    .filter((l) => typeof l === 'string' && l.length > 0)
    .slice(0, 6);
  const pathwayBlock =
    pathwayLabels.length > 0
      ? `Reported pathway (schematic, in order): ${pathwayLabels.join(' to ')}.`
      : 'No curated pathway is available for this system in the current snapshot.';
  const treatmentBlock = schematic.treatment
    ? schematic.treatment.rigor
      ? `Reported treatment: ${schematic.treatment.rigor}.`
      : schematic.treatment.processes.length > 0
        ? `Reported treatment processes: ${schematic.treatment.processes.join(', ')}.`
        : 'No treatment profile is available for this system in the current snapshot.'
    : 'No treatment profile is available for this system in the current snapshot.';

  const facilityBlock = schematic.sourceFacilities
    ? [
        schematic.sourceFacilities.facilities.slice(0, 6).map((f) => `- **${f.facilityName}** (${f.facilityType}${f.waterType ? `, ${f.waterType}` : ''})`).join('\n') ||
          'No reported facilities in snapshot.',
        schematic.sourceFacilities.sellerChain.length > 0
          ? `Purchased-water chain: ${schematic.sourceFacilities.sellerChain.map((s) => `${s.systemName} (${s.pwsid})`).join('; ')}.`
          : 'No purchased-water chain reported.',
        `Provenance: [SDWIS facility extract](${schematic.sourceFacilities.provenanceUrl}) | Version \`${schematic.sourceFacilities.sourceVersionId}\` | Captured ${schematic.sourceFacilities.dataCaptureTime}`,
      ].join('\n')
    : 'No facility extract is available for this system in the current snapshot. Verify live SDWIS facility rows at the linked efservice query.';

  const upstreamBlock = schematic.upstream
    ? [
        `- Outlet context: ${schematic.upstream.outletLabel} (representative point, never an intake coordinate).`,
        `- Upstream flowlines in range: ${schematic.upstream.upstreamCount}; pre-treatment monitoring stations in range: ${schematic.upstream.stationCount}.`,
        schematic.upstream.characteristics.length > 0
          ? `- Station characteristics observed upstream: ${schematic.upstream.characteristics.join(', ')}. Pre-treatment context only, never tap results.`
          : '- No upstream characteristic names summarized.',
        `- Provenance: [USGS NLDI](${schematic.upstream.sourceUrl}) | Captured ${schematic.upstream.dataCaptureTime} | Confidence: schematic.`,
      ].join('\n')
    : 'No upstream summary is available. USGS intake coordinates are not published; routes stay schematic.';

  const conveyanceBlock = (schematic.conveyances ?? []).length > 0
    ? (schematic.conveyances ?? []).map((c) => `- **${c.name}** (schematic conveyance)`).join('\n')
    : 'No vendored conveyances for this system.';

  const useBlock = schematic.waterUse
    ? `Modeled public-supply split for ${schematic.waterUse.referencePeriod}: about ${schematic.waterUse.surfacePct} percent surface water and ${schematic.waterUse.groundPct} percent groundwater. Source: [USGS water use](${schematic.waterUse.sourceUrl}), captured ${schematic.waterUse.dataCaptureTime}. Modeled, never a meter reading.`
    : 'No modeled water-use split is vendored for this system.';

  const complianceBlock = schematic.regulatoryCompliance.snapshotPending    ? [
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

  return `
${heading}
${sourceSentence}

*Spatial Accuracy Notice:* ${boundarySentence} Flow paths and boundaries displayed on the map represent **schematic approximations** and do not depict operational engineering alignments.

### Reported Water Quality Metrics & Audit Provenance
${metricsList}
${occurrenceNote ? `\n\n*${occurrenceNote}*` : ''}

### Source Facilities & Purchased-Water Chain (SDWIS)
${facilityBlock}

### Source to Tap Pathway (Schematic)
${pathwayBlock}

${treatmentBlock}

Large conveyances (schematic):
${conveyanceBlock}

Upstream + pre-treatment context (USGS NLDI + WQP):
${upstreamBlock}

Modeled supply split (USGS):
${useBlock}

### Regulatory Compliance Record (EPA SDWIS)
${complianceBlock}

---
*Mandatory Public Health Notice:* ${schematic.disclaimer}
`.trim();
}
