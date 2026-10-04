// Follow-up chips generated ONLY from resolver facts (supports #14).
// Every chip references ground-truth entities; unknown areas get OSM wording.
export interface ChipFacts {
  violations: number;
  windowStart: string;
  windowEnd: string;
  boundaryType: string;
  metrics: Array<{ parameter: string; reportPeriod: string }>;
}

export function suggestFollowUps(facts: ChipFacts): string[] {
  const chips: string[] = [];
  if (facts.boundaryType === 'unverified_fallback') {
    chips.push('Where is the nearest public drinking point?');
    chips.push('Why is this boundary unverified?');
    return chips;
  }
  if (facts.violations > 0) {
    chips.push(`What caused the violation in ${facts.windowStart} to ${facts.windowEnd}?`);
  } else {
    chips.push(`Any violations from ${facts.windowStart} to ${facts.windowEnd}?`);
  }
  const first = facts.metrics[0];
  if (first) chips.push(`What did the ${first.reportPeriod} report test for ${first.parameter}?`);
  chips.push('Show the watershed map');
  return chips.slice(0, 3);
}
