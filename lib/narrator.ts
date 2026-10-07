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

export type AnswerIntent = 'source' | 'quality' | 'pathway' | 'compliance' | 'general';

/**
 * Lightweight intent read for conversational answers. Keyword-only, no
 * network, no LLM: it only decides which Resolver facts lead the overview.
 * The full report (metrics, compliance, map) always stays in the cards.
 */
export function detectIntent(question: string): AnswerIntent {
  const q = (question ?? '').toLowerCase();
  const has = (...words: string[]) => words.some((w) => q.includes(w));
  if (has('violation', 'compliance', 'echo', 'sdwis', 'mcl', 'exceed', 'within standard')) return 'compliance';
  if (
    has(
      'lead', 'pfas', 'fluoride', 'chlorine', 'turbidity', 'coliform', 'copper',
      'nitrate', 'arsenic', 'lithium', 'contain', 'what is in', "what's in",
      'whats in', 'quality', 'healthy', 'safe to drink', 'drinkable',
      'test', 'report', 'result',
    )
  ) {
    return 'quality';
  }
  if (
    has(
      'how does', 'how do', 'reach', 'route', 'pathway', 'treatment',
      'plant', 'pipe', 'aqueduct', 'flow', 'travel', 'journey',
    )
  ) {
    return 'pathway';
  }
  if (has('where', 'come from', 'comes from', 'source', 'basin', 'watershed', 'reservoir', 'origin', 'map')) {
    return 'source';
  }
  return 'general';
}

export function narrateGroundTruth(schematic: WaterOriginSchematic, question = ''): Narrative {
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
  const overview = buildOverview();

  function buildOverview(): string {
    // Unknown areas and Tier B entries keep the honest legacy framing
    // (tests and the ECHO pointer depend on it).
    if (schematic.pwsid === 'UNKNOWN') {
      return (
        `Water for public water system ${schematic.systemName} (PWSID: ${schematic.pwsid}) ` +
        `is sourced from ${basinPhrase}. ` +
        `${detailPhrase} ` +
        `${boundaryPhrase}; paths on the map are schematic approximations.`
      );
    }
    if (isTierB) {
      return (
        `Water for public water system ${schematic.systemName} (PWSID: ${schematic.pwsid}). ` +
        kindSentence +
        'Source details for this system are not yet curated in the snapshot, ' +
        'so verify live records at the linked ECHO profile. ' +
        `${boundaryPhrase}; paths on the map are schematic approximations. ` +
        `${pathwayPhrase}`
      );
    }
    // Known system with basins: answer the asked question first, like a
    // normal chat turn, then point at the evidence cards below.
    const head = `Water for public water system ${schematic.systemName} (PWSID: ${schematic.pwsid})`;
    const tail = `${boundaryPhrase}; paths on the map are schematic approximations.`;
    switch (detectIntent(question)) {
      case 'source':
        return (
          `${head} comes from ${basinPhrase}. ` +
          `${kindSentence}Full lab values and the compliance record are in the cards below. ` +
          tail
        );
      case 'quality': {
        if (allReported.length === 0) {
          return (
            `${head} has no curated lab metrics in the snapshot yet. ` +
            'Verify live records at the linked ECHO profile. ' +
            tail
          );
        }
        const params = [...new Set(allReported.map((m) => m.parameter))].slice(0, 3).join(', ');
        return (
          `${head}: the ${allReported[0].provenance.reportPeriod} report lists ${params}. ` +
          'Full values with thresholds and test dates are in the table below. ' +
          tail
        );
      }
      case 'pathway':
        return (
          `${head} travels a schematic route from source areas to the tap area, traced on the map below. ` +
          tail
        );
      case 'compliance': {
        if (schematic.regulatoryCompliance.snapshotPending) {
          return (
            `${head}: compliance records are not yet curated in the snapshot. ` +
            `Verify live records at the linked ECHO system profile for the ${windowStart} to ${windowEnd} window. ` +
            tail
          );
        }
        return (
          `${head} shows ${violationsText()} violations recorded from ${windowStart} to ${windowEnd}. ` +
          'Details are linked below. ' +
          tail
        );
      }
      default:
        return (
          `${head} is sourced from ${basinPhrase}. ` +
          `${kindSentence}Details on lab results, compliance, and the schematic route are in the cards below. ` +
          tail
        );
    }
  }

  function violationsText(): number {
    return schematic.regulatoryCompliance.totalViolationsFound;
  }

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
