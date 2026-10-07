// lib/narrator.ts — ground-truth narrator (supports #6, prompt v2 in prompts/system.ts).
// Offline template stand-in for the LLM narrator: it ONLY rephrases Resolver facts
// (same numbers, basins, parameters, feature labels) in plain user-facing words.
// Production swaps this function for an LLM call with WATER_INTELLIGENCE_SYSTEM_PROMPT;
// the JEV gate + fallback contract is unchanged.
import type {
  QualityMetricRecord,
  WaterOriginSchematic,
} from '../types/water-intelligence.js';

export interface Narrative {
  overview: string;
  metricsSummary: string;
  complianceNote: string;
  stewardshipNote: string;
}

function metricSentence(m: QualityMetricRecord): string {
  return (
    `${m.parameter} was reported as ${m.reportedValue} against a ${m.regulatoryThreshold} ` +
    `standard (${m.complianceStatus}) in testing dated ${m.testDate} for the ${m.provenance.reportPeriod} report.`
  );
}

export function narrateGroundTruth(schematic: WaterOriginSchematic): Narrative {
  const basins = schematic.primaryBasins;
  // Tier B directory entry: verified PWSID + city, basins not yet curated.
  const isTierB = schematic.pwsid !== 'UNKNOWN' && basins.length === 0;
  const basinPhrase =
    basins.length === 1
      ? `the ${basins[0]} basin`
      : basins.length > 1
        ? `the ${basins.join(' and ')} basins`
        : 'basins outside the current showcase snapshot';
  const boundaryPhrase =
    schematic.boundaryType === 'verified_agency'
      ? 'The service area shown is agency-published'
      : schematic.boundaryType === 'modeled_epa'
        ? 'The service area shown is modeled from EPA geography'
        : 'Exact service-area boundaries are not shown here';
  const { startDate: windowStart, endDate: windowEnd } = schematic.regulatoryCompliance.queryWindow;
  const pathwayPhrase =
    'The schematic map traces the reported route from source areas to the tap area in order.';
  const allReported = [
    ...schematic.latestReportedMetrics,
    ...(schematic.lcrMetrics ?? []),
    ...(schematic.ucmrMetrics ?? []),
    ...(schematic.syrMetrics ?? []),
    ...(schematic.distributionMetrics ?? []),
  ];
  const detailPhrase =
    allReported.length > 0
      ? `The ${allReported[0].provenance.reportPeriod} report's lab metrics ` +
        `and the ${windowStart} to ${windowEnd} compliance record are detailed below. ` +
        `${pathwayPhrase}`
      : 'Lab metrics and compliance records for this system are not yet curated, ' +
        'so verify live records at the linked ECHO profile. ' +
        `${pathwayPhrase}`;
  const kindSentence =
    schematic.sourceKind === 'groundwater' || schematic.sourceKind === 'surface'
      ? `This is a ${schematic.sourceKind} water system. `
      : '';
  const hasFacilities = (schematic.sourceFacilities?.facilities.length ?? 0) > 0;
  const facilitySentence = hasFacilities ? 'Reported source rows are listed below. ' : '';
  const conveyanceSentence =
    (schematic.conveyances?.length ?? 0) > 0 ? 'Large conveyances are shown schematically on the map. ' : '';
  const useSentence = schematic.waterUse
    ? `Modeled public-supply split for ${schematic.waterUse.referencePeriod} is about ${schematic.waterUse.surfacePct} percent surface water and ${schematic.waterUse.groundPct} percent groundwater. `
    : '';
  const upstreamSentence = schematic.upstream
    ? `Upstream context lists ${schematic.upstream.upstreamCount} flowlines and ${schematic.upstream.stationCount} pre-treatment monitoring stations in range. `
    : '';
  const overview = isTierB
    ? `Water for public water system ${schematic.systemName} (PWSID: ${schematic.pwsid}). ` +
      kindSentence +
      'Source details for this system are not yet curated in the snapshot, ' +
      'so verify live records at the linked ECHO profile. ' +
      `${boundaryPhrase}; paths on the map are schematic approximations. ` +
      `${pathwayPhrase}`
    : `Water for public water system ${schematic.systemName} (PWSID: ${schematic.pwsid}) ` +
      `is sourced from ${basinPhrase}. ` +
      `${kindSentence}${facilitySentence}${conveyanceSentence}${useSentence}${upstreamSentence}` +
      `${detailPhrase} ` +
      `${boundaryPhrase}; paths on the map are schematic approximations.`;

  const metricsSummary =
    schematic.latestReportedMetrics.length > 0
      ? [...schematic.latestReportedMetrics, ...(schematic.lcrMetrics ?? []), ...(schematic.ucmrMetrics ?? []), ...(schematic.syrMetrics ?? []), ...(schematic.distributionMetrics ?? [])].map(metricSentence).join(' ')
      : (schematic.lcrMetrics ?? []).length + (schematic.ucmrMetrics ?? []).length + (schematic.syrMetrics ?? []).length + (schematic.distributionMetrics ?? []).length > 0
        ? [...(schematic.lcrMetrics ?? []), ...(schematic.ucmrMetrics ?? []), ...(schematic.syrMetrics ?? []), ...(schematic.distributionMetrics ?? [])].map(metricSentence).join(' ')
        : 'No reported lab metrics are available for this system in the current snapshot.';

  const violations = schematic.regulatoryCompliance.totalViolationsFound;
  const { startDate, endDate } = schematic.regulatoryCompliance.queryWindow;
  const complianceNote = schematic.regulatoryCompliance.snapshotPending
    ? `Compliance records for ${schematic.systemName} (PWSID: ${schematic.pwsid}) are not yet curated in the snapshot. ` +
      `Verify live records at the linked ECHO system profile for the ${startDate} to ${endDate} window.`
    : `Compliance with Safe Drinking Water Act record-keeping shows ${violations} ` +
      `violations recorded from ${startDate} to ${endDate}. ` +
      `Record verified at ${schematic.regulatoryCompliance.dataCaptureTime}.`;

  const stewardshipNote =
    'Reported lab results and regulatory records describe the past; they do not promise future results. ' +
    'Check the linked regulatory filing and the ECHO system profile for the underlying documents.';

  return { overview, metricsSummary, complianceNote, stewardshipNote };
}

export function joinNarrative(n: Narrative): string {
  return [n.overview, n.metricsSummary, n.complianceNote, n.stewardshipNote].join(' ');
}
