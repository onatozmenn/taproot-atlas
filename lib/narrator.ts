// lib/narrator.ts — ground-truth narrator (supports #6, prompt v2 in prompts/system.ts).
// Offline template stand-in for the LLM narrator: it ONLY rephrases Resolver facts
// (same numbers, basins, parameters, feature labels) so its output passes audit.
// Production swaps this function for an LLM call with WATER_INTELLIGENCE_SYSTEM_PROMPT;
// the audit + fallback contract is unchanged.
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
  const overview =
    `Water for public water system ${schematic.systemName} (PWSID: ${schematic.pwsid}) ` +
    `is sourced from ${basinPhrase}. ` +
    `${boundaryPhrase}; paths on the map are schematic approximations.`;

  const metricsSummary =
    schematic.latestReportedMetrics.length > 0
      ? schematic.latestReportedMetrics.map(metricSentence).join(' ')
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
