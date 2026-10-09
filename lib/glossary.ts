// lib/glossary.ts — plain-English answers for the words Taproot's own
// answers use ("what is ppb?", "what does action level mean?").
// A follow-up like that is a natural part of a tap-water conversation, so it
// must never hit the off-topic redirect. Deterministic, sourced from EPA
// definitions, no numbers about any specific system.

export interface GlossaryEntry {
  id: string;
  /** Matches the term inside a question (case-insensitive). */
  match: RegExp;
  answer: string;
  /** Follow-ups to offer; `{place}` is replaced when the conversation has a city. */
  followUps: string[];
}

const ENTRIES: GlossaryEntry[] = [
  {
    id: 'ppb',
    match: /\b(ppb|parts? per billion)\b/i,
    answer:
      'ppb means parts per billion. In water, 1 ppb is 1 microgram of a substance in 1 liter of water (1 µg/L). Lead is reported this way: the federal action level for lead is 15 ppb.',
    followUps: ['Is there lead in {place} water?', 'What is an action level?'],
  },
  {
    id: 'ppt',
    match: /\b(ppt|parts? per trillion)\b/i,
    answer:
      'ppt means parts per trillion, 1,000 times smaller than ppb. In water, 1 ppt is 1 nanogram per liter (1 ng/L). PFAS are measured in ppt: the federal limit for PFOA and PFOS is 4 ppt each.',
    followUps: ['Does {place} water have PFAS?', 'What are PFAS?'],
  },
  {
    id: 'ppm',
    match: /\b(ppm|parts? per million|mg\/l)\b/i,
    answer:
      'ppm means parts per million. In water, 1 ppm is 1 milligram per liter (1 mg/L), which is 1,000 ppb. Nitrate and copper are usually reported this way.',
    followUps: ['What is in {place} water?'],
  },
  {
    id: 'ugl',
    match: /(µg\/l|ug\/l|micrograms? per liter)/i,
    answer: 'µg/L means micrograms per liter. For water it is the same as ppb (parts per billion).',
    followUps: ['What is in {place} water?'],
  },
  {
    id: 'ngl',
    match: /(ng\/l|nanograms? per liter)/i,
    answer: 'ng/L means nanograms per liter. For water it is the same as ppt (parts per trillion), the unit used for PFAS.',
    followUps: ['Does {place} water have PFAS?'],
  },
  {
    id: 'mclg',
    match: /\b(mclg|maximum contaminant level goal)\b/i,
    answer:
      'An MCLG (maximum contaminant level goal) is the level at which EPA expects no health risk. It is a goal, not a legal limit. For lead it is zero.',
    followUps: ['What is an MCL?', 'Is there lead in {place} water?'],
  },
  {
    id: 'mcl',
    match: /\b(mcls?|maximum contaminant levels?)\b/i,
    answer:
      'An MCL (maximum contaminant level) is the legal limit EPA sets for a substance in public drinking water under the Safe Drinking Water Act. A result above it is a violation the utility must act on and tell customers about.',
    followUps: ['Has {place} water had any violations?', 'What is an MCLG?'],
  },
  {
    id: 'action-level',
    match: /\baction levels?\b/i,
    answer:
      'An action level is a trigger, not a legal limit. For lead it is 15 ppb: if more than 1 in 10 homes sampled are above it, the utility must take extra steps such as corrosion control, public education and replacing lead pipes.',
    followUps: ['Is there lead in {place} water?', 'What is the 90th percentile?'],
  },
  {
    id: '90th',
    match: /\b(90th|ninetieth) percentile\b/i,
    answer:
      'The 90th percentile is the result that 9 out of 10 homes sampled were at or below. Lead and copper are judged this way, so a 90th percentile of 7 ppb means 9 in 10 tested homes had 7 ppb or less.',
    followUps: ['Is there lead in {place} water?', 'What is an action level?'],
  },
  {
    id: 'pwsid',
    match: /\b(pwsid|pws id|public water system id)\b/i,
    answer:
      'A PWSID is the ID EPA gives every public water system: a two-letter state code followed by seven digits, like IL0316000 for Chicago. Taproot uses it to look up that system in EPA records.',
    followUps: ['Where does {place} water come from?'],
  },
  {
    id: 'pfas',
    match: /\b(pfas|pfoa|pfos|forever chemicals?)\b/i,
    answer:
      'PFAS are a family of man-made "forever chemicals" used in non-stick, waterproof and firefighting products. They break down very slowly and build up in the body. In 2024 EPA set the first federal limits, 4 ppt for PFOA and PFOS.',
    followUps: ['Does {place} water have PFAS?'],
  },
  {
    id: 'turbidity',
    match: /\b(turbidity|ntu)\b/i,
    answer:
      'Turbidity is how cloudy water is, measured in NTU. It matters because particles can shield germs from disinfection. Filtered systems must stay at or below 0.3 NTU in at least 95% of monthly samples.',
    followUps: ['How is {place} water treated?'],
  },
  {
    id: 'coliform',
    match: /\b(total coliform|coliforms?|e\.? ?coli)\b/i,
    answer:
      'Coliform bacteria are an indicator: usually harmless themselves, but finding them means germs could be getting into the water. E. coli is the type that signals contamination from sewage or animal waste.',
    followUps: ['Has {place} water had any violations?'],
  },
  {
    id: 'ccr',
    match: /\b(ccr|consumer confidence report|water quality report)\b/i,
    answer:
      'A Consumer Confidence Report (CCR) is the yearly water quality report every community water system must send its customers. It lists where the water comes from, what was found in it and any violations.',
    followUps: ['What is in {place} water?'],
  },
  {
    id: 'sdwis',
    match: /\b(sdwis|safe drinking water information system)\b/i,
    answer:
      'SDWIS is EPA’s national database of public water systems: who they serve, their water sources, violations and lead and copper results. Most of Taproot’s records come from it.',
    followUps: ['Has {place} water had any violations?'],
  },
  {
    id: 'ucmr',
    match: /\b(ucmr\s?5?|unregulated contaminant monitoring)\b/i,
    answer:
      'UCMR is EPA’s program for testing substances that are not regulated yet. The fifth round (UCMR 5, 2023–2025) tested systems for 29 PFAS and lithium, which is where Taproot’s PFAS results come from.',
    followUps: ['Does {place} water have PFAS?'],
  },
  {
    id: 'service-line',
    match: /\b(lead service lines?|service lines?|lead pipes?)\b/i,
    answer:
      'A service line is the pipe that connects a building to the water main under the street. Older ones can be made of lead, which is the main source of lead in tap water. Utilities must keep an inventory of them.',
    followUps: ['Is there lead in {place} water?'],
  },
  {
    id: 'source-kind',
    match: /\b(surface water|groundwater|ground water|aquifer)\b/i,
    answer:
      'Surface water comes from rivers, lakes and reservoirs; groundwater is pumped from aquifers underground. Surface water needs more filtering, while groundwater can pick up minerals and natural contaminants like arsenic.',
    followUps: ['Where does {place} water come from?'],
  },
  {
    id: 'dbp',
    match: /\b(tthms?|trihalomethanes?|haa5|haloacetic acids?|disinfection by-?products?)\b/i,
    answer:
      'Disinfection byproducts (TTHMs and HAA5) form when chlorine reacts with natural matter in water. They are regulated because long-term exposure above the limits raises cancer risk.',
    followUps: ['How is {place} water treated?'],
  },
  {
    id: 'chloramine',
    match: /\b(chloramines?|chlorine)\b/i,
    answer:
      'Chlorine and chloramine are disinfectants utilities add to kill germs and keep water safe through the pipes. Chloramine (chlorine plus ammonia) lasts longer and forms fewer byproducts.',
    followUps: ['How is {place} water treated?'],
  },
  {
    id: 'accuracy',
    match: /\b(how accurate|how reliable|accuracy|can i trust|how good is (?:the |taproot'?s? )?(?:forecast|model|prediction)|track record)\b/i,
    answer:
      'Two parts. Every fact in an answer is read straight from EPA records and checked against them before it is shown. The forecast was tested on the past: a list made in January 2025 from earlier records held 201 of the 303 systems that broke a health rule that year; EPA’s targeting formula, given the same number of slots, held 90. [See the full backtest](#/impact)',
    followUps: ["What's the violation risk for {place} water?", 'Which water systems are riskiest nationwide?'],
  },
  {
    id: 'risk-score',
    match: /\b(risk score|risk forecast|taproot forecast|forecast)\b/i,
    answer:
      'Taproot’s forecast is the chance that a water system gets a new health-based violation next year. A model trained on 15 years of EPA records weighs violation history, missed tests, lead results, inspections and system size. Tested on later years, its top 10% caught about 6 in 10 of the next year’s violations.',
    followUps: ["What's the violation risk for {place} water?"],
  },
  {
    id: 'violation',
    match: /\b(health-based violations?|monitoring violations?|reporting violations?)\b/i,
    answer:
      'A health-based violation means water went over a limit or missed a required treatment step. A monitoring or reporting violation means a test or report was missed or late; it does not by itself mean the water was unsafe.',
    followUps: ['Has {place} water had any violations?'],
  },
];

const EXPLAIN_RE =
  /\b(what(?:'s| is| are| does| do)|whats|meaning|means?|define|definition|explain|stand(?:s)? for|stood for|what's an?|tell me what)\b/i;

/**
 * A glossary hit for definitional questions ("what is ppb", "ppb?",
 * "what does action level mean"). Returns null for questions that only
 * mention a term in passing ("does Chicago have PFAS") so the record
 * pipeline still answers those.
 */
export function findGlossaryEntry(question: string): GlossaryEntry | null {
  const q = (question ?? '').trim();
  if (!q) return null;
  const words = q.split(/\s+/).length;
  // Questions about Taproot itself ("how accurate is Taproot?") need no "what is".
  const self = ENTRIES.find((e) => e.id === 'accuracy');
  if (self && words <= 12 && self.match.test(q)) return self;
  const explain = EXPLAIN_RE.test(q);
  if (!explain && words > 3) return null;
  if (words > 14) return null;
  // Most specific first: MCLG before MCL, ppt before ppb etc. by list order.
  for (const e of ENTRIES) if (e.match.test(q)) return e;
  return null;
}

/** Follow-ups with the conversation's place filled in, or generic ones without it. */
export function glossaryFollowUps(entry: GlossaryEntry, place: string | null): string[] {
  return entry.followUps
    .map((f) => (place ? f.replace('{place}', place) : f.includes('{place}') ? f.replace('{place} ', 'my ') : f))
    .slice(0, 3);
}

/** Short contextual follow-ups ("is that bad?") that belong to the previous answer. */
export const CONTEXT_FOLLOW_UP_RE =
  /^(?:so\s+)?(?:is (?:that|it|this) (?:bad|good|safe|ok(?:ay)?|normal|high|low|dangerous|a problem)|should i (?:be )?(?:worry|worried|concerned)|what does (?:that|this|it) mean|why|how come|explain|really|is it safe to drink|can i drink it|what should i do)\b[\s?.!]*/i;
