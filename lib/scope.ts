// lib/scope.ts — deterministic question-scope gate (America.gov parity).
// The pipeline used to ignore the question entirely, so "hi how are you"
// got the full water report. Now: water questions get the report, everything
// else gets a short redirect back to tap-water records — never an opinion,
// never a guessed fact. Pure keyword heuristics, no network, no LLM.

export type Scope = 'water' | 'greeting' | 'off_topic';

/** Any of these marks the question as tap-water business. */
const WATER_RE =
  /\b(waters?|tap|drink(?:ing)?|pwsid|watershed|basin|reservoir|aqueduct|treatment|distribution|quality|complianc|violations?|turbidity|coliform|lead|fluoride|chlorine|pfas|pipe|plumb|faucet|filter|sewer|results?|reports?|sources?|epa|echo|sdwis|dep\b|bill)\b/i;

/** Short social openers/closers with no topical content. */
const SMALLTALK_RE =
  /^(hi|hey|hello|yo|hiya|good\s?(morning|afternoon|evening|day)|how are you|how('s| is) it going|how('s| is) things|what('s| is) up|thanks?|thank you|thx|bye|goodbye|see you|ok|okay|k|test|testing+|a+s+d+f+|qwerty)[\s?.!,]*$/i;

const SMALLTALK_CONTAINS_RE = /\bhow are you\b|\bthank\b|\bthanks\b/i;

export function classifyScope(question: string): Scope {
  const q = (question ?? '').trim().toLowerCase();
  if (!q) return 'greeting';
  if (WATER_RE.test(q)) return 'water';
  if (SMALLTALK_RE.test(q) || SMALLTALK_CONTAINS_RE.test(q)) return 'greeting';
  return 'off_topic';
}

/**
 * Static redirect narratives. ASCII-only, digit-free, and free of guardrail
 * trigger nouns on purpose, so the deterministic audit passes them exactly
 * like any other template text.
 */
export function greetingNarrative(): {
  overview: string;
  metricsSummary: string;
  complianceNote: string;
} {
  return {
    overview:
      'Hello! I answer questions about tap water: where it comes from, what public lab reports say, and what EPA compliance records show.',
    metricsSummary: 'Try asking where your tap water comes from, or about past violations.',
    complianceNote: 'Every answer stays inside the public records - nothing more.',
  };
}

export function offTopicNarrative(): {
  overview: string;
  metricsSummary: string;
  complianceNote: string;
} {
  return {
    overview: 'I do not give opinions or commentary outside tap-water records.',
    metricsSummary:
      'If you have a question about tap water - its sources, public lab reports, or EPA compliance records - ask it in plain English words.',
    complianceNote: 'Every answer stays inside the public records - nothing more.',
  };
}
