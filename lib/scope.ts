// lib/scope.ts — deterministic question-scope gate (America.gov parity).
// The pipeline used to ignore the question entirely, so "hi how are you"
// got the full water report. Now: water questions get the report, everything
// else gets a short redirect back to tap-water records — never an opinion,
// never a guessed fact. Pure keyword heuristics, no network, no LLM.

export type Scope = 'water' | 'greeting' | 'off_topic';

/** Any of these marks the question as tap-water business. */
const WATER_RE =
  /\b(waters?|tap|drink(?:ing)?|pwsid|watershed|basin|reservoir|aqueduct|treatment|distribution|quality|complianc|violations?|turbidity|coliform|lead|fluoride|chlorine|pfas|pipe|plumb|faucet|filter|sewer|results?|reports?|sources?|epa|echo|sdwis|dep\b|bill|arsenic|nitrates?|nitrites?|copper|uranium|radium|radon|pfoa|pfos|forever chemicals?|bacteria|e\.? ?coli|chloramines?|trihalomethanes?|tthm|haa5|byproducts?|contaminants?|hardness|boil|utility|utilities|risk|risky|score|su|suyu|suyun|suyunda|sular\u0131|musluk|i\u00e7me suyu|kur\u015fun|arsenik|nitrat)\b/i;

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
      'Hello! I answer tap water questions in three parts: where it comes from, what public lab reports say is in it, and how it reaches your tap.',
    metricsSummary: 'Try asking where your tap water comes from, what was reported in it, or how it reaches your tap.',
    complianceNote: 'Every answer stays inside the public records - nothing more.',
  };
}

export function offTopicNarrative(): {
  overview: string;
  metricsSummary: string;
  complianceNote: string;
} {
  return {
    overview: "That one is outside what I can answer. I answer from U.S. tap-water records: where water comes from, what's in it, and how it reaches your tap.",
    metricsSummary: 'You can also ask what a term in an answer means, like ppb or action level.',
    complianceNote: 'Every answer stays inside the public records - nothing more.',
  };
}

/**
 * Follow-ups that ask about the record itself without a water keyword
 * ("When was the last inspection?", "How many people does it serve?").
 * Only used when the conversation already has a system in context.
 */
export const RECORD_FOLLOW_UP_RE =
  /\b(inspect(?:ion|ions|ed|or)?|sanitary survey|surveys?|serves?|serving|served|people|population|customers|households|connections|who (?:runs|operates|owns|manages)|operator|owner|run by|treat(?:ed|s|ing)?|tested|tests?|testing|samples?|sampled|safe|safety|healthy|clean|contaminat\w*|detected|levels?|limits?|hard|soft|taste|smell|odou?r|colou?r|cloudy|chemicals?|minerals?|how (?:many|much|often|recent)|when was|last time|latest|history|trend|over time|getting (?:better|worse)|improv\w*|worse|fixed|resolved|fine|fines|penalt\w*|enforcement)\b/i;

/** Words that start a sentence or name the record, never a place. */
const NOT_A_PLACE = new Set([
  'is', 'does', 'do', 'can', 'how', 'what', 'where', 'when', 'why', 'which', 'who', 'my', 'our', 'the', 'this', 'that', 'it', 'its', 'tap', 'drinking',
  'city', 'town', 'county', 'state', 'lake', 'river', 'us', 'u.s.', 'usa', 'america', 'american', 'united', 'epa', 'pfas', 'pfoa', 'pfos', 'lead', 'copper',
  'taproot', 'atlas', 'echo', 'sdwis', 'ucmr', 'ppb', 'ppt', 'i', 'any', 'tell', 'show', 'give', 'please', 'hi', 'hello', 'water', 'should', 'are', 'was',
  'will', 'would', 'could', 'compare', 'about', 'new york', 'nyc', 'manhattan', 'brooklyn', 'queens', 'bronx', 'staten island', 'public',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'english', 'spanish', 'turkish', 'plain', 'simple',
]);

/**
 * A capitalised name the question asks about ("Is Smallville tap water
 * safe?", "lead in Smallville"), or null. Callers use it only after every
 * resolver missed, to answer "I don't have X" instead of a showcase default.
 */
export function unresolvedPlaceName(question: string): string | null {
  const q = (question ?? '').trim();
  const name = String.raw`([A-Z\u00C0-\u024F][\p{L}'.-]+(?:\s+[A-Z\u00C0-\u024F][\p{L}'.-]+){0,2})`;
  const pats = [
    new RegExp(String.raw`\b(?:in|for|from|of|at|near|around)\s+` + name, 'u'),
    new RegExp(String.raw`^(?:[Ii]s|[Dd]oes|[Hh]ow(?:'s| is)?|[Ww]hat about|[Tt]ell me about)\s+(?:the\s+)?` + name + String.raw`(?:'s)?\s+(?:tap\s+|drinking\s+|city\s+)?water`, 'u'),
    new RegExp('^' + name + String.raw`(?:'s)?\s+(?:tap\s+|drinking\s+)?water\b`, 'u'),
    new RegExp('^' + name + String.raw`(?:'?(?:da|de|ta|te|n\u0131n|nin|nun|n\u00fcn|un|\u00fcn|in|\u0131n))?\s+(?:su|suyu|musluk)`, 'u'),
  ];
  for (const re of pats) {
    const m = q.match(re);
    if (!m) continue;
    const cand = m[1].replace(/[.'-]+$/, '').trim();
    const words = cand.toLowerCase().split(/\s+/);
    if (NOT_A_PLACE.has(cand.toLowerCase()) || NOT_A_PLACE.has(words[0])) continue;
    if (cand.length < 3) continue;
    return cand;
  }
  return null;
}
